#include <algorithm>
#include <chrono>
#include <cstdint>
#include <fstream>
#include <filesystem>
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

#ifdef _OPENMP
#include <omp.h>
#endif

namespace {

using Distance = std::int64_t;
constexpr Distance INF = std::numeric_limits<Distance>::max() / 4;
constexpr std::int64_t MAX_WEIGHT = std::numeric_limits<std::int32_t>::max();
constexpr std::size_t MAX_VERTICES = 10000;
constexpr std::size_t MAX_EDGES = 10000000;
constexpr std::uintmax_t MAX_REQUEST_BYTES = 64ULL * 1024ULL * 1024ULL;

struct CandyError final : std::runtime_error {
  std::string code;
  bool user_correctable;
  bool retryable;

  CandyError(std::string error_code, std::string message, bool correctable = true, bool can_retry = false)
      : std::runtime_error(std::move(message)), code(std::move(error_code)),
        user_correctable(correctable), retryable(can_retry) {}
};

struct EdgeChange {
  int source;
  int target;
  std::int64_t weight;
};

struct Request {
  std::string mode;
  std::string graph_type;
  std::string projection_provenance_id;
  std::string graph_id;
  std::uint64_t graph_version{};
  std::string state_graph_id;
  std::uint64_t state_graph_version{};
  std::uint64_t state_version{};
  int source{};
  int threads{1};
  std::size_t vertex_count{};
  std::size_t edge_count{};
  std::vector<std::size_t> row_offsets;
  std::vector<int> column_indices;
  std::vector<std::int64_t> weights;
  std::vector<Distance> prior_distances;
  std::vector<int> prior_parents;
  std::vector<EdgeChange> deletions;
  std::vector<EdgeChange> insertions;
};

struct SsspState {
  std::vector<Distance> distances;
  std::vector<int> parents;
};

using Graph = std::vector<std::map<int, std::int64_t>>;

[[noreturn]] void fail(const std::string &code, const std::string &message,
                       bool user_correctable = true, bool retryable = false) {
  throw CandyError(code, message, user_correctable, retryable);
}

std::string json_escape(const std::string &value) {
  std::ostringstream out;
  for (const unsigned char c : value) {
    switch (c) {
      case '"': out << "\\\""; break;
      case '\\': out << "\\\\"; break;
      case '\b': out << "\\b"; break;
      case '\f': out << "\\f"; break;
      case '\n': out << "\\n"; break;
      case '\r': out << "\\r"; break;
      case '\t': out << "\\t"; break;
      default:
        if (c < 0x20) {
          out << "\\u00" << "0123456789abcdef"[(c >> 4) & 0x0f]
              << "0123456789abcdef"[c & 0x0f];
        } else {
          out << c;
        }
    }
  }
  return out.str();
}

void expect_token(std::istream &input, const std::string &expected) {
  std::string actual;
  if (!(input >> actual) || actual != expected) {
    fail("INVALID_GRAPH_SCHEMA", "Expected request token '" + expected + "'.");
  }
}

template <typename T>
T read_scalar(std::istream &input, const std::string &label) {
  T value{};
  if (!(input >> value)) fail("INVALID_GRAPH_SCHEMA", "Missing or malformed " + label + ".");
  return value;
}

std::size_t read_count(std::istream &input, const std::string &label, std::size_t maximum) {
  const auto value = read_scalar<std::uint64_t>(input, label);
  if (value > maximum) fail("RESOURCE_LIMIT", label + " exceeds the native POC limit.");
  return static_cast<std::size_t>(value);
}

Request parse_request(const std::string &path) {
  std::error_code size_error;
  const auto request_bytes = std::filesystem::file_size(path, size_error);
  if (size_error) fail("INVALID_GRAPH_SCHEMA", "Request file could not be inspected.");
  if (request_bytes > MAX_REQUEST_BYTES) fail("RESOURCE_LIMIT", "Request file exceeds the native POC byte limit.");
  std::ifstream input(path);
  if (!input) fail("INVALID_GRAPH_SCHEMA", "Request file could not be opened.");
  expect_token(input, "CANDY_SSSP_REQUEST_V1");
  Request request;
  expect_token(input, "mode"); request.mode = read_scalar<std::string>(input, "mode");
  if (request.mode != "STATIC" && request.mode != "INCREMENTAL" && request.mode != "COMPARE") {
    fail("ALGORITHM_FAILURE", "Unsupported SSSP mode.");
  }
  expect_token(input, "graph_type"); request.graph_type = read_scalar<std::string>(input, "graph_type");
  if (request.graph_type != "OrdinaryGraph" && request.graph_type != "DynamicOrdinaryGraph" && request.graph_type != "ProjectedOrdinaryGraph") {
    fail("INVALID_GRAPH_TYPE", "SSSP accepts only an explicit ordinary-graph type; no projection was performed.");
  }
  expect_token(input, "projection_provenance_id"); request.projection_provenance_id = read_scalar<std::string>(input, "projection_provenance_id");
  if (request.graph_type == "ProjectedOrdinaryGraph") {
    if (!std::regex_match(request.projection_provenance_id, std::regex("sha256:[a-f0-9]{64}"))) fail("INVALID_GRAPH_SCHEMA", "ProjectedOrdinaryGraph requires a validated projection provenance artifact ID.");
  } else if (request.projection_provenance_id != "-") {
    fail("INVALID_GRAPH_SCHEMA", "Only ProjectedOrdinaryGraph may carry projection provenance.");
  }
  expect_token(input, "graph_id"); request.graph_id = read_scalar<std::string>(input, "graph_id");
  if (!std::regex_match(request.graph_id, std::regex("[A-Za-z0-9._:-]{1,128}"))) fail("INVALID_GRAPH_SCHEMA", "graph_id has invalid characters.");
  expect_token(input, "graph_version"); request.graph_version = read_scalar<std::uint64_t>(input, "graph_version");
  expect_token(input, "state_graph_id"); request.state_graph_id = read_scalar<std::string>(input, "state_graph_id");
  expect_token(input, "state_graph_version"); request.state_graph_version = read_scalar<std::uint64_t>(input, "state_graph_version");
  expect_token(input, "state_version"); request.state_version = read_scalar<std::uint64_t>(input, "state_version");
  expect_token(input, "source"); request.source = read_scalar<int>(input, "source");
  expect_token(input, "threads"); request.threads = read_scalar<int>(input, "threads");
  if (request.threads < 1 || request.threads > 256) fail("RESOURCE_LIMIT", "threads must be from 1 through 256.");
  expect_token(input, "vertex_count"); request.vertex_count = read_count(input, "vertex_count", MAX_VERTICES);
  if (request.source < 0 || static_cast<std::size_t>(request.source) >= request.vertex_count) fail("INVALID_VERTEX", "source is outside the native vertex range.");
  expect_token(input, "edge_count"); request.edge_count = read_count(input, "edge_count", MAX_EDGES);

  expect_token(input, "row_offsets");
  const auto row_count = read_count(input, "row_offsets count", MAX_VERTICES + 1);
  if (row_count != request.vertex_count + 1) fail("INVALID_GRAPH_SCHEMA", "row_offsets length must equal vertex_count + 1.");
  request.row_offsets.resize(row_count);
  for (auto &value : request.row_offsets) value = read_scalar<std::size_t>(input, "row offset");

  expect_token(input, "column_indices");
  const auto column_count = read_count(input, "column_indices count", MAX_EDGES);
  if (column_count != request.edge_count) fail("INVALID_GRAPH_SCHEMA", "column_indices length must equal edge_count.");
  request.column_indices.resize(column_count);
  for (auto &value : request.column_indices) value = read_scalar<int>(input, "column index");

  expect_token(input, "weights");
  const auto weight_count = read_count(input, "weights count", MAX_EDGES);
  if (weight_count != request.edge_count) fail("INVALID_GRAPH_SCHEMA", "weights length must equal edge_count.");
  request.weights.resize(weight_count);
  for (auto &value : request.weights) value = read_scalar<std::int64_t>(input, "weight");

  expect_token(input, "prior_distances");
  const auto distance_count = read_count(input, "prior_distances count", MAX_VERTICES);
  request.prior_distances.resize(distance_count);
  for (auto &value : request.prior_distances) {
    const auto token = read_scalar<std::string>(input, "prior distance");
    if (token == "INF") value = INF;
    else {
      try {
        std::size_t used = 0;
        value = std::stoll(token, &used);
        if (used != token.size() || value < 0 || value >= INF) fail("STALE_PROPERTY_STATE", "Prior distance is outside the supported range.");
      } catch (const CandyError &) { throw; }
      catch (...) { fail("STALE_PROPERTY_STATE", "Prior distance is malformed."); }
    }
  }

  expect_token(input, "prior_parents");
  const auto parent_count = read_count(input, "prior_parents count", MAX_VERTICES);
  request.prior_parents.resize(parent_count);
  for (auto &value : request.prior_parents) value = read_scalar<int>(input, "prior parent");

  expect_token(input, "deletion_count");
  const auto deletion_count = read_count(input, "deletion_count", MAX_EDGES);
  request.deletions.reserve(deletion_count);
  for (std::size_t i = 0; i < deletion_count; ++i) {
    expect_token(input, "d");
    request.deletions.push_back({read_scalar<int>(input, "deletion source"), read_scalar<int>(input, "deletion target"), 0});
  }

  expect_token(input, "insertion_count");
  const auto insertion_count = read_count(input, "insertion_count", MAX_EDGES);
  if (deletion_count + insertion_count > MAX_EDGES) fail("RESOURCE_LIMIT", "Combined update batch exceeds the native POC limit.");
  request.insertions.reserve(insertion_count);
  for (std::size_t i = 0; i < insertion_count; ++i) {
    expect_token(input, "i");
    request.insertions.push_back({read_scalar<int>(input, "insertion source"), read_scalar<int>(input, "insertion target"), read_scalar<std::int64_t>(input, "insertion weight")});
  }
  expect_token(input, "END");
  std::string trailing;
  if (input >> trailing) fail("INVALID_GRAPH_SCHEMA", "Unexpected trailing request content.");
  return request;
}

void validate_csr(const Request &request) {
  if (request.row_offsets.empty() || request.row_offsets.front() != 0 || request.row_offsets.back() != request.edge_count) fail("INVALID_GRAPH_SCHEMA", "CSR row offsets must start at zero and end at edge_count.");
  for (std::size_t i = 1; i < request.row_offsets.size(); ++i) {
    if (request.row_offsets[i] < request.row_offsets[i - 1] || request.row_offsets[i] > request.edge_count) fail("INVALID_GRAPH_SCHEMA", "CSR row offsets must be monotonic and bounded.");
  }
  for (std::size_t source = 0; source < request.vertex_count; ++source) {
    int prior_target = -1;
    for (std::size_t edge = request.row_offsets[source]; edge < request.row_offsets[source + 1]; ++edge) {
      const int target = request.column_indices[edge];
      const auto weight = request.weights[edge];
      if (target < 0 || static_cast<std::size_t>(target) >= request.vertex_count) fail("INVALID_GRAPH_SCHEMA", "CSR column index is out of range.");
      if (target <= prior_target) fail("INVALID_GRAPH_SCHEMA", "CSR targets must be strictly increasing per row; duplicates are rejected.");
      if (weight < 0 || weight > MAX_WEIGHT) fail("UNSUPPORTED_WEIGHT_MODEL", "Weight must be a non-negative 32-bit integer.");
      prior_target = target;
    }
  }
}

Graph graph_from_csr(const Request &request) {
  Graph graph(request.vertex_count);
  for (std::size_t source = 0; source < request.vertex_count; ++source) {
    for (std::size_t edge = request.row_offsets[source]; edge < request.row_offsets[source + 1]; ++edge) {
      graph[source].emplace(request.column_indices[edge], request.weights[edge]);
    }
  }
  return graph;
}

Distance safe_add(Distance left, std::int64_t right) {
  if (left == INF || right < 0 || right > MAX_WEIGHT || left > INF - right) return INF;
  return left + right;
}

SsspState dijkstra(const Graph &graph, int source) {
  SsspState state{std::vector<Distance>(graph.size(), INF), std::vector<int>(graph.size(), -1)};
  using Item = std::pair<Distance, int>;
  std::priority_queue<Item, std::vector<Item>, std::greater<Item>> queue;
  state.distances[source] = 0;
  queue.push({0, source});
  while (!queue.empty()) {
    const auto [distance, vertex] = queue.top();
    queue.pop();
    if (distance != state.distances[vertex]) continue;
    for (const auto &[target, weight] : graph[vertex]) {
      const auto candidate = safe_add(distance, weight);
      if (candidate < state.distances[target]) {
        state.distances[target] = candidate;
        state.parents[target] = vertex;
        queue.push({candidate, target});
      }
    }
  }
  state.parents[source] = -1;
  return state;
}

bool valid_shortest_path_tree(const Graph &graph, int source, const SsspState &state) {
  if (state.distances.size() != graph.size() || state.parents.size() != graph.size()) return false;
  if (state.distances[source] != 0 || state.parents[source] != -1) return false;
  for (std::size_t vertex = 0; vertex < graph.size(); ++vertex) {
    if (static_cast<int>(vertex) == source) continue;
    if (state.distances[vertex] == INF) {
      if (state.parents[vertex] != -1) return false;
      continue;
    }
    const int parent = state.parents[vertex];
    if (parent < 0 || static_cast<std::size_t>(parent) >= graph.size()) return false;
    const auto found = graph[parent].find(static_cast<int>(vertex));
    if (found == graph[parent].end() || safe_add(state.distances[parent], found->second) != state.distances[vertex]) return false;
    int cursor = static_cast<int>(vertex);
    for (std::size_t depth = 0; depth <= graph.size(); ++depth) {
      if (cursor == source) break;
      cursor = state.parents[static_cast<std::size_t>(cursor)];
      if (cursor < 0 || static_cast<std::size_t>(cursor) >= graph.size() || depth == graph.size()) return false;
    }
  }
  for (std::size_t source_vertex = 0; source_vertex < graph.size(); ++source_vertex) {
    for (const auto &[target, weight] : graph[source_vertex]) {
      if (safe_add(state.distances[source_vertex], weight) < state.distances[target]) return false;
    }
  }
  return true;
}

void validate_update_vertex(const EdgeChange &change, std::size_t count) {
  if (change.source < 0 || change.target < 0 || static_cast<std::size_t>(change.source) >= count || static_cast<std::size_t>(change.target) >= count) fail("INVALID_UPDATE_BATCH", "Update vertex is outside the native range.");
}

void validate_and_apply_updates(Graph &graph, const Request &request) {
  std::size_t current_edges = 0;
  for (const auto &row : graph) current_edges += row.size();
  std::set<std::pair<int, int>> deleted;
  std::set<std::pair<int, int>> inserted;
  for (const auto &change : request.deletions) {
    validate_update_vertex(change, graph.size());
    const auto edge = std::make_pair(change.source, change.target);
    if (!deleted.insert(edge).second) fail("INVALID_UPDATE_BATCH", "Duplicate deletion rejected.");
    if (!graph[change.source].count(change.target)) fail("INVALID_UPDATE_BATCH", "Deletion references a missing edge.");
  }
  for (const auto &change : request.insertions) {
    validate_update_vertex(change, graph.size());
    if (change.weight < 0 || change.weight > MAX_WEIGHT) fail("UNSUPPORTED_WEIGHT_MODEL", "Insertion weight must be a non-negative 32-bit integer.");
    const auto edge = std::make_pair(change.source, change.target);
    if (!inserted.insert(edge).second) fail("INVALID_UPDATE_BATCH", "Duplicate insertion rejected.");
    if (deleted.count(edge)) fail("INVALID_UPDATE_BATCH", "The same edge cannot be deleted and inserted in one Scope 1 batch.");
    if (graph[change.source].count(change.target)) fail("INVALID_UPDATE_BATCH", "Insertion duplicates an existing edge.");
  }
  if (current_edges - deleted.size() + inserted.size() > MAX_EDGES) fail("RESOURCE_LIMIT", "Updated graph exceeds the native edge limit.");
  for (const auto &change : request.deletions) graph[change.source].erase(change.target);
  for (const auto &change : request.insertions) graph[change.source].emplace(change.target, change.weight);
}

void validate_prior_state(const Request &request, const Graph &graph) {
  if (request.state_graph_id != request.graph_id || request.state_graph_version != request.graph_version) fail("STALE_GRAPH_VERSION", "Prior property graph identity/version is stale.");
  if (request.state_version == 0) fail("STALE_PROPERTY_STATE", "Prior property state version is missing.");
  if (request.prior_distances.size() != graph.size() || request.prior_parents.size() != graph.size()) fail("STALE_PROPERTY_STATE", "Prior distance/parent arrays must match vertex_count.");
  const SsspState prior{request.prior_distances, request.prior_parents};
  const auto reference = dijkstra(graph, request.source);
  if (prior.distances != reference.distances || !valid_shortest_path_tree(graph, request.source, prior)) fail("STALE_PROPERTY_STATE", "Prior property state does not match the graph/source.");
}

SsspState incremental_update(const Graph &old_graph, const Graph &updated_graph,
                             const Request &request, std::size_t &affected_count) {
  SsspState state{request.prior_distances, request.prior_parents};
  std::vector<std::vector<int>> children(old_graph.size());
  for (std::size_t vertex = 0; vertex < state.parents.size(); ++vertex) {
    const int parent = state.parents[vertex];
    if (parent >= 0) children[parent].push_back(static_cast<int>(vertex));
  }
  std::vector<unsigned char> affected(old_graph.size(), 0);
  std::queue<int> invalid_queue;
  for (const auto &change : request.deletions) {
    if (state.parents[change.target] == change.source && !affected[change.target]) {
      affected[change.target] = 1;
      invalid_queue.push(change.target);
    }
  }
  while (!invalid_queue.empty()) {
    const int vertex = invalid_queue.front();
    invalid_queue.pop();
    for (const int child : children[vertex]) {
      if (!affected[child]) {
        affected[child] = 1;
        invalid_queue.push(child);
      }
    }
  }
  for (std::size_t vertex = 0; vertex < affected.size(); ++vertex) {
    if (affected[vertex]) {
      state.distances[vertex] = INF;
      state.parents[vertex] = -1;
    }
  }

  std::vector<Distance> reconnect_distance(old_graph.size(), INF);
  std::vector<int> reconnect_parent(old_graph.size(), -1);
#ifdef _OPENMP
  omp_set_num_threads(request.threads);
#pragma omp parallel for schedule(static)
#endif
  for (std::int64_t target = 0; target < static_cast<std::int64_t>(updated_graph.size()); ++target) {
    if (!affected[static_cast<std::size_t>(target)]) continue;
    Distance best = INF;
    int parent = -1;
    for (std::size_t source = 0; source < updated_graph.size(); ++source) {
      if (affected[source] || state.distances[source] == INF) continue;
      const auto edge = updated_graph[source].find(static_cast<int>(target));
      if (edge == updated_graph[source].end()) continue;
      const auto candidate = safe_add(state.distances[source], edge->second);
      if (candidate < best || (candidate == best && candidate != INF && (parent < 0 || static_cast<int>(source) < parent))) {
        best = candidate;
        parent = static_cast<int>(source);
      }
    }
    reconnect_distance[static_cast<std::size_t>(target)] = best;
    reconnect_parent[static_cast<std::size_t>(target)] = parent;
  }

  using Item = std::pair<Distance, int>;
  std::priority_queue<Item, std::vector<Item>, std::greater<Item>> queue;
  for (std::size_t vertex = 0; vertex < affected.size(); ++vertex) {
    if (reconnect_distance[vertex] != INF) {
      state.distances[vertex] = reconnect_distance[vertex];
      state.parents[vertex] = reconnect_parent[vertex];
      queue.push({state.distances[vertex], static_cast<int>(vertex)});
    }
  }
  for (const auto &change : request.insertions) {
    const auto candidate = safe_add(state.distances[change.source], change.weight);
    if (candidate < state.distances[change.target]) {
      state.distances[change.target] = candidate;
      state.parents[change.target] = change.source;
      affected[change.target] = 1;
      queue.push({candidate, change.target});
    }
  }
  while (!queue.empty()) {
    const auto [distance, vertex] = queue.top();
    queue.pop();
    if (distance != state.distances[vertex]) continue;
    for (const auto &[target, weight] : updated_graph[vertex]) {
      const auto candidate = safe_add(distance, weight);
      if (candidate < state.distances[target]) {
        state.distances[target] = candidate;
        state.parents[target] = vertex;
        affected[target] = 1;
        queue.push({candidate, target});
      }
    }
  }
  state.parents[request.source] = -1;
  affected_count = static_cast<std::size_t>(std::count(affected.begin(), affected.end(), static_cast<unsigned char>(1)));
  return state;
}

std::string distances_json(const std::vector<Distance> &distances) {
  std::ostringstream output;
  output << '[';
  for (std::size_t i = 0; i < distances.size(); ++i) {
    if (i) output << ',';
    if (distances[i] == INF) output << "null";
    else output << distances[i];
  }
  output << ']';
  return output.str();
}

template <typename T>
std::string numbers_json(const std::vector<T> &values) {
  std::ostringstream output;
  output << '[';
  for (std::size_t i = 0; i < values.size(); ++i) {
    if (i) output << ',';
    output << values[i];
  }
  output << ']';
  return output.str();
}

void emit_error(const CandyError &error) {
  std::cout << "{\"schemaVersion\":\"candy.native-sssp-result/1\",\"ok\":false,\"error\":{\"classification\":\""
            << json_escape(error.code) << "\",\"message\":\"" << json_escape(error.what())
            << "\",\"userCorrectable\":" << (error.user_correctable ? "true" : "false")
            << ",\"retryable\":" << (error.retryable ? "true" : "false") << "}}\n";
}

void emit_result(const Request &request, const SsspState &state, std::size_t affected_count,
                 double preparation_ms, double compute_ms, double validation_ms,
                 const std::string &validation_status) {
  const auto reachable = static_cast<std::size_t>(std::count_if(state.distances.begin(), state.distances.end(), [](Distance value) { return value != INF; }));
  std::cout << "{\"schemaVersion\":\"candy.native-sssp-result/1\",\"ok\":true,"
            << "\"algorithm\":\"SSSP\",\"mode\":\"" << request.mode << "\","
            << "\"graphId\":\"" << json_escape(request.graph_id) << "\",\"graphVersion\":" << request.graph_version << ','
            << "\"source\":" << request.source << ",\"vertexCount\":" << request.vertex_count << ','
            << "\"reachableCount\":" << reachable << ",\"unreachableCount\":" << (request.vertex_count - reachable) << ','
            << "\"affectedVertices\":" << affected_count << ','
            << "\"execution\":{\"status\":\"completed\",\"exitCode\":0},"
            << "\"validation\":{\"status\":\"" << validation_status << "\",\"distanceEqualityRequired\":" << (request.mode == "COMPARE" ? "true" : "false") << ",\"parentTiePolicy\":\"VALID_SHORTEST_PATH_TREE\"},"
            << "\"metrics\":{\"preparationMs\":" << preparation_ms << ",\"computeMs\":" << compute_ms << ",\"validationMs\":" << validation_ms << "},"
            << "\"distances\":" << distances_json(state.distances) << ",\"parents\":" << numbers_json(state.parents) << "}\n";
}

}  // namespace

int main(int argc, char **argv) {
  try {
    if (argc != 3 || std::string(argv[1]) != "--request") fail("INVALID_GRAPH_SCHEMA", "Expected exactly --request <controlled-path>.");
    const auto preparation_start = std::chrono::steady_clock::now();
    const Request request = parse_request(argv[2]);
    validate_csr(request);
    const Graph original_graph = graph_from_csr(request);
    const bool incremental = request.mode != "STATIC";
    if (!incremental && (!request.prior_distances.empty() || !request.prior_parents.empty() || !request.deletions.empty() || !request.insertions.empty())) fail("INVALID_UPDATE_BATCH", "STATIC mode forbids prior state and graph updates.");
    if (incremental) validate_prior_state(request, original_graph);
    Graph updated_graph = original_graph;
    if (incremental) validate_and_apply_updates(updated_graph, request);
    const auto compute_start = std::chrono::steady_clock::now();
    const auto preparation_ms = std::chrono::duration<double, std::milli>(compute_start - preparation_start).count();
    SsspState result;
    std::size_t affected_count = 0;
    if (request.mode == "STATIC") result = dijkstra(original_graph, request.source);
    else result = incremental_update(original_graph, updated_graph, request, affected_count);
    const auto validation_start = std::chrono::steady_clock::now();
    const auto compute_ms = std::chrono::duration<double, std::milli>(validation_start - compute_start).count();
    std::string validation_status = "not_requested";
    if (request.mode == "COMPARE") {
      const auto reference = dijkstra(updated_graph, request.source);
#ifdef CANDY_TEST_FORCE_MISMATCH
      if (!result.distances.empty()) result.distances.back() = result.distances.back() == INF ? 0 : result.distances.back() + 1;
#endif
      if (result.distances != reference.distances || !valid_shortest_path_tree(updated_graph, request.source, result)) fail("RESULT_VALIDATION_FAILURE", "Incremental distances or parent tree do not match valid static SSSP semantics.", false, false);
      validation_status = "passed";
    } else if (!valid_shortest_path_tree(request.mode == "STATIC" ? original_graph : updated_graph, request.source, result)) {
      fail("ALGORITHM_FAILURE", "SSSP result failed internal semantic validation.", false, false);
    }
    const auto end = std::chrono::steady_clock::now();
    const auto validation_ms = std::chrono::duration<double, std::milli>(end - validation_start).count();
    emit_result(request, result, affected_count, preparation_ms, compute_ms, validation_ms, validation_status);
    return 0;
  } catch (const CandyError &error) {
    emit_error(error);
    return 2;
  } catch (const std::exception &error) {
    const CandyError wrapped("PROCESS_CRASH", error.what(), false, true);
    emit_error(wrapped);
    return 3;
  }
}
