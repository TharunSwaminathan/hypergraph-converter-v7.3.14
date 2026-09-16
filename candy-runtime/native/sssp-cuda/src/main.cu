#include <cuda_runtime.h>

#include <algorithm>
#include <chrono>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <limits>
#include <map>
#include <queue>
#include <regex>
#include <set>
#include <sstream>
#include <stdexcept>
#include <string>
#include <tuple>
#include <utility>
#include <vector>

#ifndef CANDY_QUALIFIED_ARCH
#define CANDY_QUALIFIED_ARCH "unqualified"
#endif

namespace {

using Clock = std::chrono::steady_clock;
using Distance = std::uint64_t;
constexpr Distance INF = std::numeric_limits<Distance>::max() / 4;
constexpr std::uint64_t MAX_WEIGHT = std::numeric_limits<std::int32_t>::max();
constexpr std::size_t MAX_VERTICES = 10000;
constexpr std::size_t MAX_EDGES = 10000000;
constexpr std::uintmax_t MAX_REQUEST_BYTES = 64ULL * 1024ULL * 1024ULL;
constexpr int BLOCK_SIZE = 256;

struct CandyError final : std::runtime_error {
  std::string code;
  CandyError(std::string value, std::string message)
      : std::runtime_error(std::move(message)), code(std::move(value)) {}
};

struct EdgeChange { int source; int target; std::uint64_t weight; };
struct Request {
  std::string backend;
  std::string mode;
  std::string graph_type;
  std::string projection_provenance_id;
  std::string graph_id;
  std::uint64_t graph_version{};
  std::string state_graph_id;
  std::uint64_t state_graph_version{};
  std::uint64_t state_version{};
  int source{};
  int cuda_device{};
  std::size_t vertex_count{};
  std::size_t edge_count{};
  std::vector<std::size_t> row_offsets;
  std::vector<int> column_indices;
  std::vector<std::uint64_t> weights;
  std::vector<Distance> prior_distances;
  std::vector<int> prior_parents;
  std::vector<EdgeChange> deletions;
  std::vector<EdgeChange> insertions;
};

using Graph = std::vector<std::map<int, std::uint64_t>>;

[[noreturn]] void fail(const std::string &code, const std::string &message) {
  throw CandyError(code, message);
}

std::string json_escape(const std::string &value) {
  std::ostringstream out;
  for (const unsigned char c : value) {
    if (c == '"') out << "\\\"";
    else if (c == '\\') out << "\\\\";
    else if (c == '\n') out << "\\n";
    else if (c == '\r') out << "\\r";
    else if (c == '\t') out << "\\t";
    else if (c < 0x20) out << "?";
    else out << c;
  }
  return out.str();
}

void expect(std::istream &in, const std::string &wanted) {
  std::string actual;
  if (!(in >> actual) || actual != wanted) fail("INVALID_GRAPH_SCHEMA", "Malformed CUDA request token.");
}

template <typename T> T scalar(std::istream &in, const std::string &label) {
  T value{};
  if (!(in >> value)) fail("INVALID_GRAPH_SCHEMA", "Missing or malformed " + label + ".");
  return value;
}

std::size_t count(std::istream &in, const std::string &label, std::size_t maximum) {
  const auto value = scalar<std::uint64_t>(in, label);
  if (value > maximum) fail("RESOURCE_LIMIT", label + " exceeds the CUDA candidate limit.");
  return static_cast<std::size_t>(value);
}

Request parse_request(const std::string &path) {
  std::error_code ec;
  const auto bytes = std::filesystem::file_size(path, ec);
  if (ec) fail("INVALID_GRAPH_SCHEMA", "Request file could not be inspected.");
  if (bytes > MAX_REQUEST_BYTES) fail("RESOURCE_LIMIT", "Request file exceeds the CUDA candidate byte limit.");
  std::ifstream in(path);
  if (!in) fail("INVALID_GRAPH_SCHEMA", "Request file could not be opened.");
  expect(in, "CANDY_SSSP_CUDA_REQUEST_V1");
  Request request;
  expect(in, "backend"); request.backend = scalar<std::string>(in, "backend");
  expect(in, "mode"); request.mode = scalar<std::string>(in, "mode");
  expect(in, "graph_type"); request.graph_type = scalar<std::string>(in, "graph_type");
  if (request.graph_type != "OrdinaryGraph" && request.graph_type != "DynamicOrdinaryGraph" && request.graph_type != "ProjectedOrdinaryGraph") {
    fail("INVALID_GRAPH_TYPE", "CUDA SSSP accepts only an explicit ordinary-graph type; no projection was performed.");
  }
  if (request.backend != "LOCAL_CUDA") fail("BACKEND_UNAVAILABLE", "This candidate accepts only LOCAL_CUDA.");
  if (request.mode != "INCREMENTAL" && request.mode != "COMPARE") fail("ALGORITHM_FAILURE", "CUDA STATIC is not implemented; only INCREMENTAL and COMPARE are supported.");
  expect(in, "projection_provenance_id"); request.projection_provenance_id = scalar<std::string>(in, "projection provenance");
  if (request.graph_type == "ProjectedOrdinaryGraph") {
    if (!std::regex_match(request.projection_provenance_id, std::regex("sha256:[a-f0-9]{64}"))) fail("INVALID_GRAPH_SCHEMA", "Projected input requires validated projection provenance.");
  } else if (request.projection_provenance_id != "-") fail("INVALID_GRAPH_SCHEMA", "Only ProjectedOrdinaryGraph may carry projection provenance.");
  expect(in, "graph_id"); request.graph_id = scalar<std::string>(in, "graph_id");
  if (!std::regex_match(request.graph_id, std::regex("[A-Za-z0-9._:-]{1,128}"))) fail("INVALID_GRAPH_SCHEMA", "graph_id has invalid characters.");
  expect(in, "graph_version"); request.graph_version = scalar<std::uint64_t>(in, "graph_version");
  expect(in, "state_graph_id"); request.state_graph_id = scalar<std::string>(in, "state_graph_id");
  expect(in, "state_graph_version"); request.state_graph_version = scalar<std::uint64_t>(in, "state_graph_version");
  expect(in, "state_version"); request.state_version = scalar<std::uint64_t>(in, "state_version");
  if (request.state_graph_id != request.graph_id || request.state_graph_version != request.graph_version) fail("STALE_GRAPH_VERSION", "Prior property graph identity/version is stale.");
  if (request.state_version == 0) fail("STALE_PROPERTY_STATE", "Prior property state version is missing.");
  expect(in, "source"); request.source = scalar<int>(in, "source");
  expect(in, "cuda_device"); request.cuda_device = scalar<int>(in, "cuda_device");
  if (request.cuda_device < 0) fail("BACKEND_UNAVAILABLE", "cuda_device must be a discovered non-negative device ID.");
  expect(in, "vertex_count"); request.vertex_count = count(in, "vertex_count", MAX_VERTICES);
  if (request.vertex_count == 0) fail("INVALID_GRAPH_SCHEMA", "The graph must contain at least one vertex.");
  if (request.source < 0 || static_cast<std::size_t>(request.source) >= request.vertex_count) fail("INVALID_VERTEX", "source is outside the vertex range.");
  expect(in, "edge_count"); request.edge_count = count(in, "edge_count", MAX_EDGES);

  expect(in, "row_offsets");
  const auto rows = count(in, "row_offsets count", MAX_VERTICES + 1);
  if (rows != request.vertex_count + 1) fail("INVALID_GRAPH_SCHEMA", "row_offsets length is invalid.");
  request.row_offsets.resize(rows);
  for (auto &value : request.row_offsets) value = scalar<std::size_t>(in, "row offset");
  expect(in, "column_indices");
  const auto columns = count(in, "column_indices count", MAX_EDGES);
  if (columns != request.edge_count) fail("INVALID_GRAPH_SCHEMA", "column_indices length is invalid.");
  request.column_indices.resize(columns);
  for (auto &value : request.column_indices) value = scalar<int>(in, "column index");
  expect(in, "weights");
  const auto weights = count(in, "weights count", MAX_EDGES);
  if (weights != request.edge_count) fail("INVALID_GRAPH_SCHEMA", "weights length is invalid.");
  request.weights.resize(weights);
  for (auto &value : request.weights) {
    value = scalar<std::uint64_t>(in, "weight");
    if (value > MAX_WEIGHT) fail("UNSUPPORTED_WEIGHT_MODEL", "CUDA SSSP requires non-negative INT32 weights.");
  }
  expect(in, "prior_distances");
  if (count(in, "prior_distances count", MAX_VERTICES) != request.vertex_count) fail("STALE_PROPERTY_STATE", "Prior distance length is invalid.");
  request.prior_distances.resize(request.vertex_count);
  for (auto &value : request.prior_distances) {
    const auto token = scalar<std::string>(in, "prior distance");
    if (token == "INF") value = INF;
    else {
      try {
        std::size_t used = 0;
        value = std::stoull(token, &used);
        if (used != token.size() || value >= INF) fail("STALE_PROPERTY_STATE", "Prior distance is outside the supported range.");
      } catch (const CandyError &) { throw; }
      catch (...) { fail("STALE_PROPERTY_STATE", "Prior distance is malformed."); }
    }
  }
  expect(in, "prior_parents");
  if (count(in, "prior_parents count", MAX_VERTICES) != request.vertex_count) fail("STALE_PROPERTY_STATE", "Prior parent length is invalid.");
  request.prior_parents.resize(request.vertex_count);
  for (auto &value : request.prior_parents) value = scalar<int>(in, "prior parent");

  expect(in, "deletion_count");
  const auto deletions = count(in, "deletion_count", MAX_EDGES);
  for (std::size_t i = 0; i < deletions; ++i) {
    expect(in, "d"); request.deletions.push_back({scalar<int>(in, "deletion source"), scalar<int>(in, "deletion target"), 0});
  }
  expect(in, "insertion_count");
  const auto insertions = count(in, "insertion_count", MAX_EDGES);
  if (deletions + insertions > MAX_EDGES) fail("RESOURCE_LIMIT", "Update batch exceeds the CUDA candidate limit.");
  for (std::size_t i = 0; i < insertions; ++i) {
    expect(in, "i");
    const int source = scalar<int>(in, "insertion source");
    const int target = scalar<int>(in, "insertion target");
    const auto weight = scalar<std::uint64_t>(in, "insertion weight");
    if (weight > MAX_WEIGHT) fail("UNSUPPORTED_WEIGHT_MODEL", "Insertion weight exceeds INT32.");
    request.insertions.push_back({source, target, weight});
  }
  expect(in, "END");
  std::string trailing;
  if (in >> trailing) fail("INVALID_GRAPH_SCHEMA", "Unexpected trailing request content.");
  return request;
}

Graph graph_from_csr(const Request &request) {
  if (request.row_offsets.front() != 0 || request.row_offsets.back() != request.edge_count) fail("INVALID_GRAPH_SCHEMA", "CSR boundary offsets are invalid.");
  Graph graph(request.vertex_count);
  for (std::size_t u = 0; u < request.vertex_count; ++u) {
    if (request.row_offsets[u] > request.row_offsets[u + 1] || request.row_offsets[u + 1] > request.edge_count) fail("INVALID_GRAPH_SCHEMA", "CSR offsets are not monotonic.");
    for (std::size_t e = request.row_offsets[u]; e < request.row_offsets[u + 1]; ++e) {
      const int v = request.column_indices[e];
      if (v < 0 || static_cast<std::size_t>(v) >= request.vertex_count) fail("INVALID_GRAPH_SCHEMA", "CSR column index is invalid.");
      if (!graph[u].emplace(v, request.weights[e]).second) fail("INVALID_GRAPH_SCHEMA", "Duplicate directed edge is not allowed.");
    }
  }
  return graph;
}

Distance add(Distance left, std::uint64_t right) {
  return left >= INF || right >= INF || left > INF - right ? INF : left + right;
}

void validate_state(const Graph &graph, const Request &request) {
  const auto &dist = request.prior_distances;
  const auto &parent = request.prior_parents;
  if (dist[request.source] != 0 || parent[request.source] != -1) fail("STALE_PROPERTY_STATE", "Source convention is invalid.");
  for (std::size_t u = 0; u < graph.size(); ++u) {
    for (const auto &[v, weight] : graph[u]) if (add(dist[u], weight) < dist[v]) fail("STALE_PROPERTY_STATE", "Prior distances violate an edge relaxation.");
  }
  for (std::size_t v = 0; v < graph.size(); ++v) {
    if (static_cast<int>(v) == request.source) continue;
    if (dist[v] >= INF) {
      if (parent[v] != -1) fail("STALE_PROPERTY_STATE", "Unreachable vertex has a parent.");
      continue;
    }
    const int p = parent[v];
    if (p < 0 || static_cast<std::size_t>(p) >= graph.size()) fail("STALE_PROPERTY_STATE", "Reachable vertex has an invalid parent.");
    const auto edge = graph[p].find(static_cast<int>(v));
    if (edge == graph[p].end() || add(dist[p], edge->second) != dist[v]) fail("STALE_PROPERTY_STATE", "Parent edge does not justify the prior distance.");
    std::set<int> seen;
    int cursor = static_cast<int>(v);
    while (cursor != request.source) {
      if (cursor < 0 || static_cast<std::size_t>(cursor) >= graph.size() || !seen.insert(cursor).second) fail("STALE_PROPERTY_STATE", "Prior parent state contains a cycle.");
      cursor = parent[cursor];
    }
  }
}

void validate_vertex(int value, std::size_t count) {
  if (value < 0 || static_cast<std::size_t>(value) >= count) fail("INVALID_UPDATE_BATCH", "Update vertex is outside the graph.");
}

std::vector<bool> apply_updates(Graph &graph, const Request &request) {
  std::set<std::pair<int, int>> changed;
  std::vector<int> roots;
  for (const auto &edge : request.deletions) {
    validate_vertex(edge.source, graph.size()); validate_vertex(edge.target, graph.size());
    const auto key = std::make_pair(edge.source, edge.target);
    if (!changed.insert(key).second || !graph[edge.source].count(edge.target)) fail("INVALID_UPDATE_BATCH", "Deletion is duplicate or does not exist.");
    if (request.prior_parents[edge.target] == edge.source) roots.push_back(edge.target);
  }
  for (const auto &edge : request.insertions) {
    validate_vertex(edge.source, graph.size()); validate_vertex(edge.target, graph.size());
    const auto key = std::make_pair(edge.source, edge.target);
    if (!changed.insert(key).second || graph[edge.source].count(edge.target)) fail("INVALID_UPDATE_BATCH", "Insertion conflicts with the declared REJECT policy.");
  }
  for (const auto &edge : request.deletions) graph[edge.source].erase(edge.target);
  for (const auto &edge : request.insertions) graph[edge.source].emplace(edge.target, edge.weight);

  std::vector<std::vector<int>> children(graph.size());
  for (std::size_t v = 0; v < graph.size(); ++v) if (request.prior_parents[v] >= 0) children[request.prior_parents[v]].push_back(static_cast<int>(v));
  std::vector<bool> invalid(graph.size(), false);
  std::queue<int> pending;
  for (const int root : roots) if (!invalid[root]) { invalid[root] = true; pending.push(root); }
  while (!pending.empty()) {
    const int u = pending.front(); pending.pop();
    for (const int v : children[u]) if (!invalid[v]) { invalid[v] = true; pending.push(v); }
  }
  return invalid;
}

std::vector<Distance> static_reference(const Graph &graph, int source) {
  std::vector<Distance> dist(graph.size(), INF);
  using Item = std::pair<Distance, int>;
  std::priority_queue<Item, std::vector<Item>, std::greater<Item>> queue;
  dist[source] = 0; queue.push({0, source});
  while (!queue.empty()) {
    const auto [current, u] = queue.top(); queue.pop();
    if (current != dist[u]) continue;
    for (const auto &[v, weight] : graph[u]) {
      const auto candidate = add(current, weight);
      if (candidate < dist[v]) { dist[v] = candidate; queue.push({candidate, v}); }
    }
  }
  return dist;
}

std::vector<int> parent_tree(const Graph &graph, const std::vector<Distance> &dist, int source) {
  std::vector<int> parent(graph.size(), -1);
  std::vector<bool> reached(graph.size(), false);
  std::queue<int> queue;
  reached[source] = true; queue.push(source);
  while (!queue.empty()) {
    const int u = queue.front(); queue.pop();
    for (const auto &[v, weight] : graph[u]) {
      if (!reached[v] && add(dist[u], weight) == dist[v]) {
        reached[v] = true; parent[v] = u; queue.push(v);
      }
    }
  }
  for (std::size_t v = 0; v < graph.size(); ++v) if (dist[v] < INF && !reached[v]) fail("RESULT_VALIDATION_FAILURE", "GPU distances do not admit a source-rooted parent tree.");
  return parent;
}

template <typename T> std::size_t checked_bytes(std::size_t count_value) {
  if (count_value > std::numeric_limits<std::size_t>::max() / sizeof(T)) fail("RESOURCE_LIMIT", "CUDA allocation size overflow.");
  return count_value * sizeof(T);
}

std::size_t checked_add(std::size_t left, std::size_t right) {
  if (left > std::numeric_limits<std::size_t>::max() - right) fail("RESOURCE_LIMIT", "CUDA memory estimate overflow.");
  return left + right;
}

class DeviceAllocations {
 public:
  template <typename T> void allocate(T **target, std::size_t count_value) {
#ifdef CANDY_TEST_FORCE_ALLOCATION_FAILURE
    fail("RESOURCE_LIMIT", "Qualification-only forced CUDA allocation failure.");
#endif
    const auto error = cudaMalloc(reinterpret_cast<void **>(target), checked_bytes<T>(std::max<std::size_t>(count_value, 1)));
    if (error != cudaSuccess) fail("RESOURCE_LIMIT", "CUDA allocation failed after preflight.");
    values_.push_back(*target);
  }
  void release_checked() {
    cudaError_t first = cudaSuccess;
    for (auto it = values_.rbegin(); it != values_.rend(); ++it) {
      const auto error = cudaFree(*it);
      if (first == cudaSuccess && error != cudaSuccess) first = error;
    }
    values_.clear();
    if (first != cudaSuccess) fail("ALGORITHM_FAILURE", "CUDA resource release failed.");
  }
  ~DeviceAllocations() { for (auto it = values_.rbegin(); it != values_.rend(); ++it) cudaFree(*it); }
 private:
  std::vector<void *> values_;
};

void cuda_check(cudaError_t value, const std::string &operation, const std::string &code = "ALGORITHM_FAILURE") {
  if (value != cudaSuccess) fail(code, operation + " failed: " + cudaGetErrorString(value));
}

__global__ void relax_edges(const int *sources, const int *targets, const std::uint64_t *weights,
                            std::size_t edge_count, std::uint64_t *distances, int *changed) {
  const std::size_t edge = static_cast<std::size_t>(blockIdx.x) * blockDim.x + threadIdx.x;
  if (edge >= edge_count) return;
  const int u = sources[edge];
  const int v = targets[edge];
  const auto parent_distance = atomicAdd(reinterpret_cast<unsigned long long *>(&distances[u]), 0ULL);
  if (parent_distance >= INF) return;
  const auto weight = weights[edge];
  const auto candidate = parent_distance > INF - weight ? INF : parent_distance + weight;
  const auto old = atomicMin(reinterpret_cast<unsigned long long *>(&distances[v]), candidate);
  if (candidate < old) atomicExch(changed, 1);
}

struct GpuResult {
  std::vector<Distance> distances;
  std::string device_name;
  int major{};
  int minor{};
  double h2d_ms{};
  double kernel_ms{};
  double d2h_ms{};
};

GpuResult run_gpu(const Graph &graph, std::vector<Distance> initial, int device) {
#ifdef CANDY_TEST_FORCE_MEMORY_REFUSAL
  fail("RESOURCE_LIMIT", "Qualification-only forced CUDA memory preflight refusal.");
#endif
  int device_count = 0;
  cuda_check(cudaGetDeviceCount(&device_count), "CUDA device discovery", "BACKEND_UNAVAILABLE");
  if (device >= device_count) fail("BACKEND_UNAVAILABLE", "Requested CUDA device is not available.");
  cuda_check(cudaSetDevice(device), "CUDA device selection", "BACKEND_UNAVAILABLE");
  cudaDeviceProp properties{};
  cuda_check(cudaGetDeviceProperties(&properties, device), "CUDA device properties", "BACKEND_UNAVAILABLE");
  if (properties.major < 7) fail("BACKEND_UNAVAILABLE", "CUDA device compute capability is below the candidate minimum 7.0.");

  std::vector<int> sources;
  std::vector<int> targets;
  std::vector<std::uint64_t> weights;
  for (std::size_t u = 0; u < graph.size(); ++u) for (const auto &[v, weight] : graph[u]) {
    sources.push_back(static_cast<int>(u)); targets.push_back(v); weights.push_back(weight);
  }
  std::size_t required = checked_add(checked_bytes<int>(sources.size()), checked_bytes<int>(targets.size()));
  required = checked_add(required, checked_bytes<std::uint64_t>(weights.size()));
  required = checked_add(required, checked_bytes<Distance>(initial.size()));
  required = checked_add(required, sizeof(int));
  std::size_t free_bytes = 0, total_bytes = 0;
  cuda_check(cudaMemGetInfo(&free_bytes, &total_bytes), "CUDA memory discovery", "BACKEND_UNAVAILABLE");
  if (required > free_bytes - free_bytes / 4) fail("RESOURCE_LIMIT", "CUDA memory preflight refused the request.");

  int *d_sources = nullptr, *d_targets = nullptr, *d_changed = nullptr;
  std::uint64_t *d_weights = nullptr, *d_distances = nullptr;
  DeviceAllocations allocations;
  allocations.allocate(&d_sources, sources.size()); allocations.allocate(&d_targets, targets.size());
  allocations.allocate(&d_weights, weights.size()); allocations.allocate(&d_distances, initial.size()); allocations.allocate(&d_changed, 1);
  const auto h2d_start = Clock::now();
  if (!sources.empty()) {
    cuda_check(cudaMemcpy(d_sources, sources.data(), checked_bytes<int>(sources.size()), cudaMemcpyHostToDevice), "CUDA source transfer");
    cuda_check(cudaMemcpy(d_targets, targets.data(), checked_bytes<int>(targets.size()), cudaMemcpyHostToDevice), "CUDA target transfer");
    cuda_check(cudaMemcpy(d_weights, weights.data(), checked_bytes<std::uint64_t>(weights.size()), cudaMemcpyHostToDevice), "CUDA weight transfer");
  }
  cuda_check(cudaMemcpy(d_distances, initial.data(), checked_bytes<Distance>(initial.size()), cudaMemcpyHostToDevice), "CUDA distance transfer");
  const auto h2d_end = Clock::now();

  const auto kernel_start = Clock::now();
  bool converged = sources.empty();
  for (std::size_t iteration = 0; iteration < graph.size() && !sources.empty(); ++iteration) {
    cuda_check(cudaMemset(d_changed, 0, sizeof(int)), "CUDA convergence reset");
#ifdef CANDY_TEST_FORCE_LAUNCH_FAILURE
    relax_edges<<<0, 0>>>(d_sources, d_targets, d_weights, sources.size(), d_distances, d_changed);
#else
    const auto blocks = static_cast<unsigned int>((sources.size() + BLOCK_SIZE - 1) / BLOCK_SIZE);
    relax_edges<<<blocks, BLOCK_SIZE>>>(d_sources, d_targets, d_weights, sources.size(), d_distances, d_changed);
#endif
    cuda_check(cudaGetLastError(), "CUDA relaxation kernel launch");
#ifdef CANDY_TEST_FORCE_SYNC_FAILURE
    fail("ALGORITHM_FAILURE", "Qualification-only forced CUDA synchronization failure.");
#endif
    cuda_check(cudaDeviceSynchronize(), "CUDA relaxation synchronization");
    int changed = 0;
    cuda_check(cudaMemcpy(&changed, d_changed, sizeof(int), cudaMemcpyDeviceToHost), "CUDA convergence transfer");
    if (!changed) { converged = true; break; }
  }
#ifdef CANDY_TEST_FORCE_NONCONVERGENCE
  converged = false;
#endif
  if (!converged) fail("RESULT_VALIDATION_FAILURE", "CUDA relaxation did not converge within the vertex bound.");
  const auto kernel_end = Clock::now();
  const auto d2h_start = Clock::now();
  cuda_check(cudaMemcpy(initial.data(), d_distances, checked_bytes<Distance>(initial.size()), cudaMemcpyDeviceToHost), "CUDA result transfer");
  const auto d2h_end = Clock::now();
  allocations.release_checked();
  return {std::move(initial), properties.name, properties.major, properties.minor,
          std::chrono::duration<double, std::milli>(h2d_end - h2d_start).count(),
          std::chrono::duration<double, std::milli>(kernel_end - kernel_start).count(),
          std::chrono::duration<double, std::milli>(d2h_end - d2h_start).count()};
}

void print_distances(const std::vector<Distance> &values) {
  std::cout << "[";
  for (std::size_t i = 0; i < values.size(); ++i) { if (i) std::cout << ","; if (values[i] >= INF) std::cout << "null"; else std::cout << values[i]; }
  std::cout << "]";
}

void print_parents(const std::vector<int> &values) {
  std::cout << "[";
  for (std::size_t i = 0; i < values.size(); ++i) { if (i) std::cout << ","; std::cout << values[i]; }
  std::cout << "]";
}

}  // namespace

int main(int argc, char **argv) {
  try {
    if (argc != 3 || std::string(argv[1]) != "--request") fail("INVALID_GRAPH_SCHEMA", "Expected exactly --request <server-owned-path>.");
    const auto total_start = Clock::now();
    const auto preparation_start = Clock::now();
    const Request request = parse_request(argv[2]);
    Graph graph = graph_from_csr(request);
    validate_state(graph, request);
    const auto invalid = apply_updates(graph, request);
    auto initial = request.prior_distances;
    for (std::size_t v = 0; v < invalid.size(); ++v) if (invalid[v]) initial[v] = INF;
    initial[request.source] = 0;
    const auto preparation_end = Clock::now();
    GpuResult gpu = run_gpu(graph, std::move(initial), request.cuda_device);
#ifdef CANDY_TEST_FORCE_COMPARE_MISMATCH
    gpu.distances[request.source] = 1;
#endif
    const auto reference_start = Clock::now();
    const auto reference = static_reference(graph, request.source);
    if (gpu.distances != reference) fail("RESULT_VALIDATION_FAILURE", "CUDA distances differ from the independent static reference.");
    const auto parents = parent_tree(graph, gpu.distances, request.source);
    const auto reference_end = Clock::now();
    std::size_t affected = 0, reachable = 0;
    for (std::size_t v = 0; v < gpu.distances.size(); ++v) {
      affected += gpu.distances[v] != request.prior_distances[v] || parents[v] != request.prior_parents[v];
      reachable += gpu.distances[v] < INF;
    }
    const auto total_end = Clock::now();
    const auto ms = [](auto value) { return std::chrono::duration<double, std::milli>(value).count(); };
    std::cout << "{\"schemaVersion\":\"candy.native-sssp-result/1\",\"ok\":true,\"algorithm\":\"SSSP\",\"backend\":\"LOCAL_CUDA\",\"mode\":\"" << request.mode
              << "\",\"graphId\":\"" << json_escape(request.graph_id) << "\",\"graphVersion\":" << request.graph_version
              << ",\"source\":" << request.source << ",\"vertexCount\":" << request.vertex_count
              << ",\"reachableCount\":" << reachable << ",\"unreachableCount\":" << request.vertex_count - reachable
              << ",\"affectedVertices\":" << affected << ",\"device\":{\"id\":" << request.cuda_device << ",\"name\":\"" << json_escape(gpu.device_name)
              << "\",\"computeCapability\":\"" << gpu.major << "." << gpu.minor << "\",\"qualifiedArchitecture\":\"" << CANDY_QUALIFIED_ARCH
              << "\"},\"validation\":{\"status\":\"passed\"},\"metrics\":{\"preparationMs\":" << ms(preparation_end - preparation_start)
              << ",\"hostToDeviceMs\":" << gpu.h2d_ms << ",\"kernelMs\":" << gpu.kernel_ms << ",\"deviceToHostMs\":" << gpu.d2h_ms
              << ",\"referenceMs\":" << ms(reference_end - reference_start) << ",\"totalMs\":" << ms(total_end - total_start) << "},\"distances\":";
    print_distances(gpu.distances); std::cout << ",\"parents\":"; print_parents(parents); std::cout << "}\n";
    return 0;
  } catch (const CandyError &error) {
    std::cout << "{\"schemaVersion\":\"candy.native-sssp-result/1\",\"ok\":false,\"error\":{\"classification\":\"" << json_escape(error.code)
              << "\",\"message\":\"" << json_escape(error.what()) << "\"}}\n";
    return 1;
  } catch (...) {
    std::cout << "{\"schemaVersion\":\"candy.native-sssp-result/1\",\"ok\":false,\"error\":{\"classification\":\"ALGORITHM_FAILURE\",\"message\":\"CUDA candidate failed safely.\"}}\n";
    return 1;
  }
}
