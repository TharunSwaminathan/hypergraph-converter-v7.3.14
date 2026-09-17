// Independent CANDY Scope 4B1 implementation. Mathematical authority: Scope 4A-R.
// No upstream ESCHER code or lookup data is used.
#include <cuda_runtime.h>
#include <algorithm>
#include <array>
#include <charconv>
#include <cstdint>
#include <fcntl.h>
#include <iostream>
#include <limits>
#include <set>
#include <sstream>
#include <stdexcept>
#include <string>
#include <sys/stat.h>
#include <unistd.h>
#include <vector>

#ifndef CANDY_QUALIFIED_ARCH
#define CANDY_QUALIFIED_ARCH "unqualified"
#endif

namespace {
constexpr std::uint64_t SAFE_INTEGER = 9007199254740991ULL;
constexpr std::size_t MAX_BYTES = 2 * 1024 * 1024;
constexpr unsigned BLOCK = 256;
constexpr const char *TAXONOMY = "candy.hypergraph-3edge-motif-taxonomy/1";
struct CandyError : std::runtime_error {
  std::string code;
  CandyError(std::string c, std::string m) : std::runtime_error(m), code(std::move(c)) {}
};
[[noreturn]] void fail(const std::string &code, const std::string &message) { throw CandyError(code, message); }
std::uint64_t multiply(std::uint64_t a, std::uint64_t b) {
  if (b && a > std::numeric_limits<std::uint64_t>::max() / b) fail("RESOURCE_LIMIT", "Integer multiplication exceeds native range.");
  return a * b;
}
std::string escape(const std::string &value) {
  std::ostringstream out;
  const char *hex = "0123456789abcdef";
  for (unsigned char c : value) {
    if (c == '"' || c == '\\') out << '\\' << c;
    else if (c < 32) out << "\\u00" << hex[c >> 4] << hex[c & 15];
    else out << c;
  }
  return out.str();
}
struct Descriptor {
  int value;
  explicit Descriptor(int fd) : value(fd) {}
  ~Descriptor() { if (value >= 0) close(value); }
  Descriptor(const Descriptor &) = delete;
};
std::string read_request(const char *path) {
  // One descriptor prevents check/open races; O_NONBLOCK avoids FIFO hangs.
  Descriptor fd(open(path, O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC));
  struct stat status{};
  if (fd.value < 0 || fstat(fd.value, &status) || !S_ISREG(status.st_mode)) fail("INVALID_GRAPH_SCHEMA", "Request must be an accessible regular file without a final symlink.");
  if (status.st_size < 0 || static_cast<std::uint64_t>(status.st_size) > MAX_BYTES) fail("RESOURCE_LIMIT", "Request exceeds the byte limit.");
  std::string value;
  std::array<char, 4096> buffer{};
  for (;;) {
    auto got = read(fd.value, buffer.data(), buffer.size());
    if (got < 0) fail("INVALID_GRAPH_SCHEMA", "Request read failed.");
    if (!got) break;
    if (static_cast<std::size_t>(got) > MAX_BYTES - value.size()) fail("RESOURCE_LIMIT", "Request grew beyond the byte limit.");
    value.append(buffer.data(), static_cast<std::size_t>(got));
  }
  return value;
}
class Parser {
  std::istringstream input;
public:
  explicit Parser(const std::string &s) : input(s) {}
  std::string token() {
    std::string s;
    if (!(input >> s)) fail("INVALID_GRAPH_SCHEMA", "Missing request token.");
    return s;
  }
  void expect(const std::string &s) { if (token() != s) fail("INVALID_GRAPH_SCHEMA", "Unexpected request token."); }
  std::uint64_t number(std::uint64_t max) {
    auto s = token();
    if (s.empty() || s.size() > 16 || !std::all_of(s.begin(), s.end(), [](char c) { return c >= '0' && c <= '9'; })) fail("INVALID_GRAPH_SCHEMA", "Expected unsigned safe decimal integer.");
    std::uint64_t result{};
    auto parsed = std::from_chars(s.data(), s.data() + s.size(), result);
    if (parsed.ec != std::errc{} || parsed.ptr != s.data() + s.size() || result > max) fail("RESOURCE_LIMIT", "Numeric field exceeds its hard limit.");
    return result;
  }
  void end() { expect("END"); std::string s; if (input >> s) fail("INVALID_GRAPH_SCHEMA", "Forbidden trailing request content."); }
};
struct Request {
  std::string graph_hex, graph_type;
  std::uint64_t version{}, triple_count{};
  unsigned vertices{}, edges{}, incidences{}, device{};
  std::vector<unsigned> offsets, members;
};
Request parse(const std::string &text) {
  Parser p(text);
  p.expect("CANDY_HYPERGRAPH_MOTIF_CUDA_STATIC_REQUEST_V1");
  p.expect("algorithm"); if (p.token() != "HYPERGRAPH_3EDGE_MOTIF_COUNT") fail("ALGORITHM_FAILURE", "Unsupported algorithm.");
  p.expect("taxonomy"); if (p.token() != TAXONOMY) fail("INVALID_GRAPH_SCHEMA", "Unsupported taxonomy.");
  p.expect("mode"); if (p.token() != "STATIC") fail("UNSUPPORTED_MODE", "Only STATIC mode is supported.");
  Request r;
  p.expect("graph_type"); r.graph_type = p.token();
  if (r.graph_type != "Hypergraph" && r.graph_type != "DynamicHypergraph") fail("INVALID_GRAPH_TYPE", "Only incidence hypergraph types are supported; no projection.");
  p.expect("graph_id_u16"); r.graph_hex = p.token();
  if (r.graph_hex.empty() || r.graph_hex.size() > 2048 || r.graph_hex.size() % 4 || !std::all_of(r.graph_hex.begin(), r.graph_hex.end(), [](char c) { return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'); })) fail("INVALID_GRAPH_SCHEMA", "Invalid UTF-16 graph identity encoding.");
  p.expect("graph_version"); r.version = p.number(SAFE_INTEGER);
  p.expect("cuda_device"); r.device = static_cast<unsigned>(p.number(2147483647));
  p.expect("vertex_count"); r.vertices = static_cast<unsigned>(p.number(1000000));
  p.expect("hyperedge_count"); r.edges = static_cast<unsigned>(p.number(256));
  p.expect("incidence_count"); r.incidences = static_cast<unsigned>(p.number(100000));
  if (r.edges >= 3) {
    auto visits = multiply(multiply(r.incidences, r.edges - 1), r.edges - 2) / 2;
    if (visits > 5000000) fail("RESOURCE_LIMIT", "Aggregate membership visits exceed the qualified oracle budget.");
    r.triple_count = multiply(multiply(r.edges, r.edges - 1), r.edges - 2) / 6;
  }
  p.expect("offsets"); if (p.number(257) != r.edges + 1) fail("INVALID_GRAPH_SCHEMA", "Offset count mismatch.");
  r.offsets.resize(r.edges + 1);
  for (auto &offset : r.offsets) offset = static_cast<unsigned>(p.number(r.incidences));
  if (r.offsets.front() != 0 || r.offsets.back() != r.incidences) fail("INVALID_GRAPH_SCHEMA", "Offset endpoints mismatch.");
  for (unsigned edge = 0; edge < r.edges; ++edge) if (r.offsets[edge] >= r.offsets[edge + 1]) fail("INVALID_GRAPH_SCHEMA", "Empty edges or decreasing offsets are forbidden.");
  p.expect("memberships"); if (p.number(100000) != r.incidences) fail("INVALID_GRAPH_SCHEMA", "Flattened incidence length mismatch.");
  r.members.resize(r.incidences);
  for (auto &member : r.members) {
    member = static_cast<unsigned>(p.number(1000000));
    if (member >= r.vertices) fail("INVALID_VERTEX", "Membership outside declared vertex range.");
  }
  for (unsigned edge = 0; edge < r.edges; ++edge) for (unsigned at = r.offsets[edge] + 1; at < r.offsets[edge + 1]; ++at) if (r.members[at - 1] >= r.members[at]) fail("INVALID_GRAPH_SCHEMA", "Memberships must be sorted and unique within each edge.");
  p.end();
  return r;
}

// Region membership subsets in qualified region order. All classification data
// is derived here by group action, never embedded from an upstream lookup.
constexpr std::array<unsigned, 7> SUBSETS = {1, 2, 4, 3, 6, 5, 7};
bool connected(unsigned mask) {
  unsigned pairs = ((mask & ((1 << 3) | (1 << 6))) != 0) + ((mask & ((1 << 4) | (1 << 6))) != 0) + ((mask & ((1 << 5) | (1 << 6))) != 0);
  return pairs >= 2; // Two pair intersections already imply all three edges nonempty.
}
unsigned canonical(unsigned mask) {
  std::array<unsigned, 3> permutation = {0, 1, 2};
  unsigned best = 128;
  do {
    unsigned transformed = 0;
    for (unsigned region = 0; region < 7; ++region) if (mask & (1 << region)) {
      unsigned target = 0;
      for (unsigned edge = 0; edge < 3; ++edge) if (SUBSETS[region] & (1 << edge)) target |= 1 << permutation[edge];
      auto found = std::find(SUBSETS.begin(), SUBSETS.end(), target);
      transformed |= 1 << static_cast<unsigned>(found - SUBSETS.begin());
    }
    best = std::min(best, transformed);
  } while (std::next_permutation(permutation.begin(), permutation.end()));
  return best;
}
std::array<int, 128> classifier() {
  std::set<unsigned> orbits;
  unsigned labeled = 0, closed = 0;
  for (unsigned mask = 0; mask < 128; ++mask) if (connected(mask)) { ++labeled; orbits.insert(canonical(mask)); }
  std::vector<unsigned> masks(orbits.begin(), orbits.end());
  for (unsigned mask : masks) if ((mask & 64) || (mask & 56) == 56) ++closed;
  if (labeled != 96 || masks.size() != 30 || closed != 24) fail("ALGORITHM_FAILURE", "Derived taxonomy invariants failed.");
  std::array<int, 128> lookup{};
  lookup.fill(-1);
  for (unsigned mask = 0; mask < 128; ++mask) if (connected(mask)) lookup[mask] = static_cast<int>(std::lower_bound(masks.begin(), masks.end(), canonical(mask)) - masks.begin());
  return lookup;
}
void cuda_check(cudaError_t status) { if (status != cudaSuccess) fail("BACKEND_UNAVAILABLE", std::string("CUDA operation failed: ") + cudaGetErrorString(status)); }
template<class T> struct DeviceBuffer {
  T *data = nullptr;
  explicit DeviceBuffer(std::size_t count) {
    auto bytes = multiply(std::max<std::size_t>(count, 1), sizeof(T));
    if (bytes > std::numeric_limits<std::size_t>::max()) fail("RESOURCE_LIMIT", "Device allocation size overflow.");
    cuda_check(cudaMalloc(reinterpret_cast<void **>(&data), static_cast<std::size_t>(bytes)));
  }
  ~DeviceBuffer() { if (data) cudaFree(data); }
  void release() { T *old = data; data = nullptr; cuda_check(cudaFree(old)); }
  DeviceBuffer(const DeviceBuffer &) = delete;
};
struct Event {
  cudaEvent_t value = nullptr;
  Event() { cuda_check(cudaEventCreate(&value)); }
  ~Event() { if (value) cudaEventDestroy(value); }
  void release() { auto old = value; value = nullptr; cuda_check(cudaEventDestroy(old)); }
  Event(const Event &) = delete;
};
__global__ void count_triples(unsigned n, unsigned slots, const unsigned *offsets, const unsigned *members, const int *lookup, unsigned long long *counts) {
  unsigned index = blockIdx.x * blockDim.x + threadIdx.x;
  if (index >= slots || n < 3) return;
  unsigned k = index % n, j = (index / n) % n, i = index / (n * n);
  if (!(i < j && j < k)) return;
  unsigned cursor[3] = {offsets[i], offsets[j], offsets[k]};
  unsigned end[3] = {offsets[i + 1], offsets[j + 1], offsets[k + 1]};
  unsigned mask = 0;
  while (cursor[0] < end[0] || cursor[1] < end[1] || cursor[2] < end[2]) {
    unsigned vertex = 0xffffffffU;
    for (unsigned edge = 0; edge < 3; ++edge) if (cursor[edge] < end[edge]) vertex = min(vertex, members[cursor[edge]]);
    unsigned subset = 0;
    for (unsigned edge = 0; edge < 3; ++edge) if (cursor[edge] < end[edge] && members[cursor[edge]] == vertex) { subset |= 1 << edge; ++cursor[edge]; }
    unsigned region = subset == 1 ? 0 : subset == 2 ? 1 : subset == 4 ? 2 : subset == 3 ? 3 : subset == 6 ? 4 : subset == 5 ? 5 : 6;
    mask |= 1 << region;
  }
  int bin = lookup[mask];
  if (bin >= 0) atomicAdd(counts + bin, 1ULL);
}
void execute(const Request &r) {
#ifdef CANDY_TEST_FAULT_UNAVAILABLE
  fail("BACKEND_UNAVAILABLE", "Qualification-only forced runtime unavailable.");
#endif
  int devices = 0;
  cuda_check(cudaGetDeviceCount(&devices));
  if (devices <= 0 || r.device >= static_cast<unsigned>(devices)) fail("BACKEND_UNAVAILABLE", "Requested CUDA device is unavailable.");
  cuda_check(cudaSetDevice(static_cast<int>(r.device)));
  cudaDeviceProp prop{};
  cuda_check(cudaGetDeviceProperties(&prop, static_cast<int>(r.device)));
  auto slots = multiply(multiply(r.edges, r.edges), r.edges);
  auto blocks = std::max<std::uint64_t>(1, (slots + BLOCK - 1) / BLOCK);
  if (slots > std::numeric_limits<unsigned>::max() || BLOCK > static_cast<unsigned>(prop.maxThreadsPerBlock) || blocks > static_cast<unsigned>(prop.maxGridSize[0])) fail("RESOURCE_LIMIT", "Grid/block dimensions exceed device limits.");
  auto lookup = classifier();
#ifdef CANDY_TEST_FAULT_ALLOCATION
  cuda_check(cudaErrorMemoryAllocation);
#endif
  DeviceBuffer<unsigned> offsets(r.offsets.size()), members(r.members.size());
  DeviceBuffer<int> table(lookup.size());
  DeviceBuffer<unsigned long long> counts(30);
  cuda_check(cudaMemcpy(offsets.data, r.offsets.data(), r.offsets.size() * sizeof(unsigned), cudaMemcpyHostToDevice));
  if (!r.members.empty()) cuda_check(cudaMemcpy(members.data, r.members.data(), r.members.size() * sizeof(unsigned), cudaMemcpyHostToDevice));
  cuda_check(cudaMemcpy(table.data, lookup.data(), lookup.size() * sizeof(int), cudaMemcpyHostToDevice));
  cuda_check(cudaMemset(counts.data, 0, 30 * sizeof(unsigned long long)));
  Event start, finish;
  cuda_check(cudaEventRecord(start.value));
#ifdef CANDY_TEST_FAULT_LAUNCH
  cuda_check(cudaErrorInvalidConfiguration);
#endif
  count_triples<<<static_cast<unsigned>(blocks), BLOCK>>>(r.edges, static_cast<unsigned>(slots), offsets.data, members.data, table.data, counts.data);
  cuda_check(cudaGetLastError());
  cuda_check(cudaEventRecord(finish.value));
#ifdef CANDY_TEST_FAULT_SYNC
  cuda_check(cudaErrorLaunchFailure);
#endif
  cuda_check(cudaDeviceSynchronize());
  float milliseconds = 0;
  cuda_check(cudaEventElapsedTime(&milliseconds, start.value, finish.value));
  std::array<unsigned long long, 30> result{};
  cuda_check(cudaMemcpy(result.data(), counts.data, sizeof(result), cudaMemcpyDeviceToHost));
  unsigned long long total = 0;
  for (auto bin : result) {
    if (bin > r.triple_count || total > r.triple_count - bin) fail("RESULT_VALIDATION_FAILURE", "CUDA counts exceed the combinatorial bound.");
    total += bin;
  }
  int runtime = 0, driver = 0;
  cuda_check(cudaRuntimeGetVersion(&runtime)); cuda_check(cudaDriverGetVersion(&driver));
  offsets.release(); members.release(); table.release(); counts.release();
  start.release(); finish.release();
  std::ostringstream identity;
  identity << '"';
  for (std::size_t index = 0; index < r.graph_hex.size(); index += 4) identity << "\\u" << r.graph_hex.substr(index, 4);
  identity << '"';
  std::cout << "{\"ok\":true,\"schemaVersion\":\"candy.hypergraph-motif-cuda-static-result/1\",\"algorithm\":\"HYPERGRAPH_3EDGE_MOTIF_COUNT\",\"taxonomyVersion\":\"" << TAXONOMY
    << "\",\"backend\":\"CUDA_STATIC\",\"mode\":\"STATIC\",\"inputGraphRef\":{\"graphId\":" << identity.str() << ",\"graphVersion\":" << r.version << "},\"counts\":[";
  for (unsigned bin = 0; bin < 30; ++bin) std::cout << (bin ? "," : "") << result[bin];
  std::cout << "],\"totalConnectedTriples\":" << total << ",\"cuda\":{\"deviceIndex\":" << r.device << ",\"deviceName\":\"" << escape(prop.name)
    << "\",\"computeMajor\":" << prop.major << ",\"computeMinor\":" << prop.minor << ",\"compiledArchitecture\":\"" << CANDY_QUALIFIED_ARCH
    << "\",\"compilerVersion\":\"" << __CUDACC_VER_MAJOR__ << '.' << __CUDACC_VER_MINOR__ << '.' << __CUDACC_VER_BUILD__
    << "\",\"runtimeVersion\":" << runtime << ",\"driverVersion\":" << driver << ",\"kernelLaunchSucceeded\":true,\"synchronizationSucceeded\":true,\"kernelMilliseconds\":" << milliseconds << "}}\n";
}
}
int main(int argc, char **argv) {
  try {
    if (argc != 3 || std::string(argv[1]) != "--request") fail("INVALID_GRAPH_SCHEMA", "Expected --request <regular-file> only.");
    execute(parse(read_request(argv[2])));
    return 0;
  } catch (const CandyError &e) {
    std::cout << "{\"ok\":false,\"error\":{\"classification\":\"" << escape(e.code) << "\",\"message\":\"" << escape(e.what()) << "\"}}\n";
  } catch (const std::bad_alloc &) {
    std::cout << "{\"ok\":false,\"error\":{\"classification\":\"RESOURCE_LIMIT\",\"message\":\"Host allocation failed.\"}}\n";
  } catch (const std::exception &) {
    std::cout << "{\"ok\":false,\"error\":{\"classification\":\"ALGORITHM_FAILURE\",\"message\":\"Unexpected native failure.\"}}\n";
  }
  return 1;
}
