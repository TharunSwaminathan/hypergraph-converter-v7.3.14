CXX ?= g++
CXXFLAGS ?= -std=c++17 -O2 -Wall -Wextra -Wpedantic -fopenmp
TARGET := build/candy-sssp-openmp
SOURCE := src/main.cpp

.PHONY: all clean fault-test sanitize sanitize-fault

all: $(TARGET)

$(TARGET): $(SOURCE)
	@mkdir -p build
	$(CXX) $(CXXFLAGS) -o $@ $<

clean:
	rm -rf build

fault-test: build/candy-sssp-openmp-fault

build/candy-sssp-openmp-fault: $(SOURCE)
	@mkdir -p build
	$(CXX) $(CXXFLAGS) -DCANDY_TEST_FORCE_MISMATCH=1 -o $@ $<

sanitize: build/candy-sssp-openmp-sanitize

build/candy-sssp-openmp-sanitize: $(SOURCE)
	@mkdir -p build
	$(CXX) $(CXXFLAGS) -O1 -g -fsanitize=address,undefined -fno-omit-frame-pointer -o $@ $<

sanitize-fault: build/candy-sssp-openmp-sanitize-fault

build/candy-sssp-openmp-sanitize-fault: $(SOURCE)
	@mkdir -p build
	$(CXX) $(CXXFLAGS) -O1 -g -fsanitize=address,undefined -fno-omit-frame-pointer -DCANDY_TEST_FORCE_MISMATCH=1 -o $@ $<
