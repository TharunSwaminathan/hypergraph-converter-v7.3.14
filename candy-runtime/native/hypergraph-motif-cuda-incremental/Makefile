NVCC ?= nvcc
CUDA_ARCH ?=
NVFLAGS ?= -std=c++17 -O2 -lineinfo -Xcompiler=-Wall,-Wextra
TARGET := build/candy-hypergraph-motif-cuda-incremental
SOURCE := src/main.cu

ifeq ($(strip $(CUDA_ARCH)),)
$(error CUDA_ARCH is required from the verified device/toolkit)
endif

.PHONY: all qualification-faults
all: $(TARGET)

$(TARGET): $(SOURCE) Makefile
	@mkdir -p build
	$(NVCC) $(NVFLAGS) -arch=$(CUDA_ARCH) -DCANDY_QUALIFIED_ARCH=\"$(CUDA_ARCH)\" -o $@ $<

build/candy-hypergraph-motif-cuda-incremental-fault-%: $(SOURCE) Makefile
	@mkdir -p build
	$(NVCC) $(NVFLAGS) -arch=$(CUDA_ARCH) -DCANDY_QUALIFIED_ARCH=\"$(CUDA_ARCH)\" -DCANDY_TEST_FAULT_$*=1 -o $@ $<

qualification-faults: $(addprefix build/candy-hypergraph-motif-cuda-incremental-fault-,UNAVAILABLE ALLOCATION LAUNCH SYNC)
