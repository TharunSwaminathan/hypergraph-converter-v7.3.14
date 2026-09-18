// Independent CANDY Scope 4B2 implementation. Mathematical authority: Scope 4A-R.
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

// Standard SHA-256 integrity binding, independent of motif classification.
std::string sha256(const std::string &text) {
  constexpr std::array<std::uint32_t, 64> k = {
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2};
  std::array<std::uint32_t, 8> h = {0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19};
  std::vector<unsigned char> bytes(text.begin(), text.end());
  auto bits = multiply(bytes.size(), 8);
  bytes.push_back(0x80);
  while (bytes.size() % 64 != 56) bytes.push_back(0);
  for (int shift = 56; shift >= 0; shift -= 8) bytes.push_back(static_cast<unsigned char>(bits >> shift));
  auto rotate = [](std::uint32_t x, unsigned n) { return (x >> n) | (x << (32 - n)); };
  for (std::size_t block = 0; block < bytes.size(); block += 64) {
    std::array<std::uint32_t, 64> w{};
    for (unsigned i = 0; i < 16; ++i) for (unsigned j = 0; j < 4; ++j) w[i] = (w[i] << 8) | bytes[block + 4*i + j];
    for (unsigned i = 16; i < 64; ++i) {
      auto s0 = rotate(w[i-15],7) ^ rotate(w[i-15],18) ^ (w[i-15] >> 3);
      auto s1 = rotate(w[i-2],17) ^ rotate(w[i-2],19) ^ (w[i-2] >> 10);
      w[i] = w[i-16] + s0 + w[i-7] + s1;
    }
    auto v = h;
    for (unsigned i = 0; i < 64; ++i) {
      auto s1 = rotate(v[4],6) ^ rotate(v[4],11) ^ rotate(v[4],25);
      auto t1 = v[7] + s1 + ((v[4] & v[5]) ^ (~v[4] & v[6])) + k[i] + w[i];
      auto s0 = rotate(v[0],2) ^ rotate(v[0],13) ^ rotate(v[0],22);
      auto t2 = s0 + ((v[0] & v[1]) ^ (v[0] & v[2]) ^ (v[1] & v[2]));
      for (unsigned j = 7; j > 0; --j) v[j] = v[j-1];
      v[4] += t1; v[0] = t1 + t2;
    }
    for (unsigned i = 0; i < 8; ++i) h[i] += v[i];
  }
  std::string result;
  const char *hex = "0123456789abcdef";
  for (auto word : h) for (int shift = 28; shift >= 0; shift -= 4) result += hex[(word >> shift) & 15];
  return result;
}
std::uint64_t choose3(unsigned n) { return n < 3 ? 0 : multiply(multiply(n, n-1), n-2) / 6; }
struct Triple { unsigned i, j, k; };
static_assert(sizeof(Triple) == 12, "Bounded packed candidate layout");
struct Snapshot {
  unsigned vertices{}, edges{}, incidences{};
  std::uint64_t candidate_count{};
  std::vector<unsigned> tags, offsets, members, affected;
};
struct Request {
  std::string graph_hex, update_hex, digest;
  std::uint64_t old_version{}, new_version{};
  unsigned device{};
  Snapshot old_graph, new_graph;
};
std::string identity(Parser &p) {
  auto s = p.token();
  if (s.empty() || s.size() > 2048 || s.size() % 4 || !std::all_of(s.begin(), s.end(), [](char c) { return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'); })) fail("INVALID_GRAPH_SCHEMA", "Invalid bounded UTF-16 identity.");
  return s;
}
Snapshot snapshot(Parser &p, const std::string &prefix) {
  Snapshot s;
  p.expect(prefix + "vertex_count"); s.vertices = static_cast<unsigned>(p.number(1000000));
  p.expect(prefix + "hyperedge_count"); s.edges = static_cast<unsigned>(p.number(256));
  p.expect(prefix + "incidence_count"); s.incidences = static_cast<unsigned>(p.number(100000));
  if (s.edges >= 3 && multiply(multiply(s.incidences, s.edges-1), s.edges-2) / 2 > 5000000) fail("RESOURCE_LIMIT", "Snapshot exceeds qualified full-snapshot work budget.");
  p.expect(prefix + "edge_tags"); if (p.number(256) != s.edges) fail("INVALID_GRAPH_SCHEMA", "Semantic edge tag count mismatch.");
  s.tags.resize(s.edges);
  for (auto &tag : s.tags) tag = static_cast<unsigned>(p.number(511));
  for (unsigned i = 1; i < s.edges; ++i) if (s.tags[i-1] >= s.tags[i]) fail("INVALID_GRAPH_SCHEMA", "Semantic tags must be sorted unique.");
  p.expect(prefix + "offsets"); if (p.number(257) != s.edges+1) fail("INVALID_GRAPH_SCHEMA", "Offset count mismatch.");
  s.offsets.resize(s.edges+1);
  for (auto &offset : s.offsets) offset = static_cast<unsigned>(p.number(s.incidences));
  if (s.offsets.front() != 0 || s.offsets.back() != s.incidences) fail("INVALID_GRAPH_SCHEMA", "Offset endpoints mismatch.");
  for (unsigned i = 0; i < s.edges; ++i) if (s.offsets[i] >= s.offsets[i+1]) fail("INVALID_GRAPH_SCHEMA", "Empty edge or invalid offsets.");
  p.expect(prefix + "memberships"); if (p.number(100000) != s.incidences) fail("INVALID_GRAPH_SCHEMA", "Membership count mismatch.");
  s.members.resize(s.incidences);
  for (auto &v : s.members) { v = static_cast<unsigned>(p.number(1000000)); if (v >= s.vertices) fail("INVALID_VERTEX", "Membership outside common vertex universe."); }
  for (unsigned i = 0; i < s.edges; ++i) for (unsigned at = s.offsets[i]+1; at < s.offsets[i+1]; ++at) if (s.members[at-1] >= s.members[at]) fail("INVALID_GRAPH_SCHEMA", "Memberships must be sorted unique.");
  p.expect(prefix + "affected"); auto count = static_cast<unsigned>(p.number(s.edges));
  s.affected.resize(count);
  for (auto &v : s.affected) { v = static_cast<unsigned>(p.number(256)); if (v >= s.edges) fail("INVALID_UPDATE_BATCH", "Affected index outside snapshot."); }
  for (unsigned i = 1; i < count; ++i) if (s.affected[i-1] >= s.affected[i]) fail("INVALID_UPDATE_BATCH", "Affected indices must be sorted unique.");
  p.expect(prefix + "candidate_count"); s.candidate_count = p.number(2763520);
  if (s.candidate_count != choose3(s.edges) - choose3(s.edges-count)) fail("INVALID_UPDATE_BATCH", "Affected candidate count mismatch.");
  return s;
}
void unchanged(const Snapshot &old, const Snapshot &next) {
  unsigned i = 0, j = 0;
  auto skip = [](const Snapshot &s, unsigned &index) { while (index < s.edges && std::binary_search(s.affected.begin(), s.affected.end(), index)) ++index; };
  for (;;) {
    skip(old, i); skip(next, j);
    if (i == old.edges || j == next.edges) {
      if (i != old.edges || j != next.edges) fail("INVALID_UPDATE_BATCH", "Unchanged semantic edge sets differ.");
      break;
    }
    if (old.tags[i] != next.tags[j] || !std::equal(old.members.begin()+old.offsets[i], old.members.begin()+old.offsets[i+1], next.members.begin()+next.offsets[j], next.members.begin()+next.offsets[j+1])) fail("INVALID_UPDATE_BATCH", "Unchanged semantic incidence differs.");
    ++i; ++j;
  }
}
Request parse(const std::string &text) {
  Parser p(text);
  p.expect("CANDY_HYPERGRAPH_MOTIF_CUDA_INCREMENTAL_REQUEST_V1");
  Request r;
  p.expect("request_digest"); r.digest = p.token();
  auto first = text.find('\n'), second = first == std::string::npos ? first : text.find('\n', first+1);
  if (r.digest.size() != 64 || second == std::string::npos || text.substr(0, second+1) != "CANDY_HYPERGRAPH_MOTIF_CUDA_INCREMENTAL_REQUEST_V1\nrequest_digest " + r.digest + "\n" || sha256(text.substr(second+1)) != r.digest) fail("INVALID_GRAPH_SCHEMA", "Payload digest/transport framing mismatch.");
  p.expect("algorithm"); if (p.token() != "HYPERGRAPH_3EDGE_MOTIF_COUNT") fail("ALGORITHM_FAILURE", "Unsupported algorithm.");
  p.expect("taxonomy"); if (p.token() != TAXONOMY) fail("INVALID_GRAPH_SCHEMA", "Unsupported taxonomy.");
  p.expect("mode"); if (p.token() != "INCREMENTAL") fail("UNSUPPORTED_MODE", "Only INCREMENTAL mode is supported.");
  p.expect("graph_type"); if (p.token() != "DynamicHypergraph") fail("INVALID_GRAPH_TYPE", "INCREMENTAL requires DynamicHypergraph; no projection.");
  p.expect("graph_id_u16"); r.graph_hex = identity(p);
  p.expect("old_graph_version"); r.old_version = p.number(SAFE_INTEGER);
  p.expect("new_graph_version"); r.new_version = p.number(SAFE_INTEGER);
  if (r.old_version == SAFE_INTEGER || r.new_version != r.old_version+1) fail("STALE_GRAPH_VERSION", "Expected exact next graph version.");
  p.expect("update_id_u16"); r.update_hex = identity(p);
  p.expect("cuda_device"); r.device = static_cast<unsigned>(p.number(2147483647));
  r.old_graph = snapshot(p, "old_"); r.new_graph = snapshot(p, "new_");
  if (r.old_graph.vertices != r.new_graph.vertices) fail("INVALID_UPDATE_BATCH", "Snapshots must share the packed vertex universe.");
  unchanged(r.old_graph, r.new_graph);
  p.end();
  return r;
}
std::vector<Triple> candidates(const Snapshot &s) {
  auto bytes = multiply(s.candidate_count, sizeof(Triple));
  if (bytes > 33162240 || bytes > std::numeric_limits<std::size_t>::max()) fail("RESOURCE_LIMIT", "Candidate storage limit exceeded.");
  std::vector<Triple> out;
  out.reserve(static_cast<std::size_t>(s.candidate_count));
  std::array<bool, 256> affected{};
  for (auto i : s.affected) affected[i] = true;
  // Exactly one visit per sorted tuple: no anchor ownership and no duplicates.
  if (s.candidate_count) for (unsigned i = 0; i < s.edges; ++i) for (unsigned j = i+1; j < s.edges; ++j) for (unsigned k = j+1; k < s.edges; ++k) if (affected[i] || affected[j] || affected[k]) out.push_back({i,j,k});
  if (out.size() != s.candidate_count) fail("ALGORITHM_FAILURE", "Candidate generation invariant failed.");
  return out;
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
__global__ void count_triples(unsigned slots, const Triple *triples, const unsigned *offsets, const unsigned *members, const int *lookup, unsigned long long *counts) {
  unsigned index = blockIdx.x * blockDim.x + threadIdx.x;
  if (index >= slots) return;
  auto triple = triples[index];
  unsigned i = triple.i, j = triple.j, k = triple.k;
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

std::array<unsigned long long, 30> affected_count(const Snapshot &s, const std::vector<Triple> &tuples, const std::array<int,128> &lookup, const cudaDeviceProp &prop, float &milliseconds) {
  auto blocks = std::max<std::uint64_t>(1, (tuples.size()+BLOCK-1) / BLOCK);
  if (tuples.size() > std::numeric_limits<unsigned>::max() || BLOCK > static_cast<unsigned>(prop.maxThreadsPerBlock) || blocks > static_cast<unsigned>(prop.maxGridSize[0])) fail("RESOURCE_LIMIT", "Grid dimensions exceed device limits.");
  DeviceBuffer<unsigned> offsets(s.offsets.size()), members(s.members.size());
  DeviceBuffer<Triple> triples(tuples.size());
  DeviceBuffer<int> table(lookup.size());
  DeviceBuffer<unsigned long long> counts(30);
  cuda_check(cudaMemcpy(offsets.data,s.offsets.data(),s.offsets.size()*sizeof(unsigned),cudaMemcpyHostToDevice));
  if (!s.members.empty()) cuda_check(cudaMemcpy(members.data,s.members.data(),s.members.size()*sizeof(unsigned),cudaMemcpyHostToDevice));
  if (!tuples.empty()) cuda_check(cudaMemcpy(triples.data,tuples.data(),tuples.size()*sizeof(Triple),cudaMemcpyHostToDevice));
  cuda_check(cudaMemcpy(table.data,lookup.data(),lookup.size()*sizeof(int),cudaMemcpyHostToDevice));
  cuda_check(cudaMemset(counts.data,0,30*sizeof(unsigned long long)));
  Event start, finish;
  cuda_check(cudaEventRecord(start.value));
#ifdef CANDY_TEST_FAULT_LAUNCH
  cuda_check(cudaErrorInvalidConfiguration);
#endif
  count_triples<<<static_cast<unsigned>(blocks),BLOCK>>>(static_cast<unsigned>(tuples.size()),triples.data,offsets.data,members.data,table.data,counts.data);
  cuda_check(cudaGetLastError());
  cuda_check(cudaEventRecord(finish.value));
#ifdef CANDY_TEST_FAULT_SYNC
  cuda_check(cudaErrorLaunchFailure);
#endif
  cuda_check(cudaDeviceSynchronize());
  float elapsed = 0;
  cuda_check(cudaEventElapsedTime(&elapsed,start.value,finish.value)); milliseconds += elapsed;
  std::array<unsigned long long,30> result{};
  cuda_check(cudaMemcpy(result.data(),counts.data,sizeof(result),cudaMemcpyDeviceToHost));
  unsigned long long total = 0;
  for (auto bin : result) { if (bin > tuples.size() || total > tuples.size()-bin) fail("RESULT_VALIDATION_FAILURE", "Affected counts exceed candidate bound."); total += bin; }
  offsets.release(); members.release(); triples.release(); table.release(); counts.release(); start.release(); finish.release();
  return result;
}
std::string json_identity(const std::string &hex) {
  std::string value = "\"";
  for (std::size_t i = 0; i < hex.size(); i += 4) value += "\\u" + hex.substr(i,4);
  return value + "\"";
}
template<class T> void json_array(const std::array<T,30> &values) {
  std::cout << '[';
  for (unsigned i = 0; i < 30; ++i) std::cout << (i ? "," : "") << values[i];
  std::cout << ']';
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
  cuda_check(cudaGetDeviceProperties(&prop,static_cast<int>(r.device)));
  auto old_candidates = candidates(r.old_graph), new_candidates = candidates(r.new_graph);
  auto lookup = classifier();
#ifdef CANDY_TEST_FAULT_ALLOCATION
  cuda_check(cudaErrorMemoryAllocation);
#endif
  float milliseconds = 0;
  auto old_counts = affected_count(r.old_graph,old_candidates,lookup,prop,milliseconds);
  auto new_counts = affected_count(r.new_graph,new_candidates,lookup,prop,milliseconds);
  std::array<std::int64_t,30> delta{};
  std::int64_t total = 0;
  for (unsigned i = 0; i < 30; ++i) {
    if (old_counts[i] > 2763520 || new_counts[i] > 2763520) fail("RESULT_VALIDATION_FAILURE", "Signed conversion bound failed.");
    delta[i] = static_cast<std::int64_t>(new_counts[i]) - static_cast<std::int64_t>(old_counts[i]);
    // At most 30 differences bounded by 2763520: sum cannot approach int64 range.
    total += delta[i];
  }
  int runtime = 0, driver = 0;
  cuda_check(cudaRuntimeGetVersion(&runtime)); cuda_check(cudaDriverGetVersion(&driver));
  std::cout << "{\"ok\":true,\"schemaVersion\":\"candy.hypergraph-motif-cuda-incremental-result/1\",\"algorithm\":\"HYPERGRAPH_3EDGE_MOTIF_COUNT\",\"taxonomyVersion\":\"" << TAXONOMY
    << "\",\"backend\":\"CUDA_INCREMENTAL\",\"mode\":\"INCREMENTAL\",\"inputGraphRef\":{\"graphId\":" << json_identity(r.graph_hex) << ",\"graphVersion\":" << r.old_version
    << "},\"outputGraphRef\":{\"graphId\":" << json_identity(r.graph_hex) << ",\"graphVersion\":" << r.new_version << "},\"updateId\":" << json_identity(r.update_hex) << ",\"requestDigest\":\"" << r.digest
    << "\",\"oldAffectedEdgeCount\":" << r.old_graph.affected.size() << ",\"newAffectedEdgeCount\":" << r.new_graph.affected.size()
    << ",\"oldCandidateCount\":" << old_candidates.size() << ",\"newCandidateCount\":" << new_candidates.size() << ",\"oldAffectedCounts\":";
  json_array(old_counts); std::cout << ",\"newAffectedCounts\":"; json_array(new_counts); std::cout << ",\"deltaCounts\":"; json_array(delta);
  std::cout << ",\"deltaTotalConnectedTriples\":" << total << ",\"cuda\":{\"deviceIndex\":" << r.device << ",\"deviceName\":\"" << escape(prop.name)
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
