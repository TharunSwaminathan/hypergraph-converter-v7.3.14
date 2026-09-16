NVCC ?= nvcc
CUDA_ARCH ?=
NVFLAGS ?= -std=c++17 -O2 -lineinfo -Xcompiler=-Wall,-Wextra
TARGET := build/candy-sssp-cuda
SOURCE := src/main.cu

ifeq ($(strip $(CUDA_ARCH)),)
$(error CUDA_ARCH is required; derive it from the trusted qualification device/toolkit)
endif

.PHONY: all clean fault-memory fault-allocation fault-launch fault-sync fault-nonconvergence fault-mismatch qualification-faults

all: $(TARGET)

$(TARGET): $(SOURCE)
	@mkdir -p build
	$(NVCC) $(NVFLAGS) -arch=$(CUDA_ARCH) -DCANDY_QUALIFIED_ARCH=\"$(CUDA_ARCH)\" -o $@ $<

fault-memory: build/candy-sssp-cuda-fault-memory

build/candy-sssp-cuda-fault-memory: $(SOURCE)
	@mkdir -p build
	$(NVCC) $(NVFLAGS) -arch=$(CUDA_ARCH) -DCANDY_QUALIFIED_ARCH=\"$(CUDA_ARCH)\" -DCANDY_TEST_FORCE_MEMORY_REFUSAL=1 -o $@ $<

fault-allocation: build/candy-sssp-cuda-fault-allocation

build/candy-sssp-cuda-fault-allocation: $(SOURCE)
	@mkdir -p build
	$(NVCC) $(NVFLAGS) -arch=$(CUDA_ARCH) -DCANDY_QUALIFIED_ARCH=\"$(CUDA_ARCH)\" -DCANDY_TEST_FORCE_ALLOCATION_FAILURE=1 -o $@ $<

fault-launch: build/candy-sssp-cuda-fault-launch

build/candy-sssp-cuda-fault-launch: $(SOURCE)
	@mkdir -p build
	$(NVCC) $(NVFLAGS) -arch=$(CUDA_ARCH) -DCANDY_QUALIFIED_ARCH=\"$(CUDA_ARCH)\" -DCANDY_TEST_FORCE_LAUNCH_FAILURE=1 -o $@ $<

fault-sync: build/candy-sssp-cuda-fault-sync

build/candy-sssp-cuda-fault-sync: $(SOURCE)
	@mkdir -p build
	$(NVCC) $(NVFLAGS) -arch=$(CUDA_ARCH) -DCANDY_QUALIFIED_ARCH=\"$(CUDA_ARCH)\" -DCANDY_TEST_FORCE_SYNC_FAILURE=1 -o $@ $<

fault-nonconvergence: build/candy-sssp-cuda-fault-nonconvergence

build/candy-sssp-cuda-fault-nonconvergence: $(SOURCE)
	@mkdir -p build
	$(NVCC) $(NVFLAGS) -arch=$(CUDA_ARCH) -DCANDY_QUALIFIED_ARCH=\"$(CUDA_ARCH)\" -DCANDY_TEST_FORCE_NONCONVERGENCE=1 -o $@ $<

fault-mismatch: build/candy-sssp-cuda-fault-mismatch

build/candy-sssp-cuda-fault-mismatch: $(SOURCE)
	@mkdir -p build
	$(NVCC) $(NVFLAGS) -arch=$(CUDA_ARCH) -DCANDY_QUALIFIED_ARCH=\"$(CUDA_ARCH)\" -DCANDY_TEST_FORCE_COMPARE_MISMATCH=1 -o $@ $<

qualification-faults: fault-memory fault-allocation fault-launch fault-sync fault-nonconvergence fault-mismatch

clean:
	rm -rf build
