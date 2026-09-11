NVCC ?= nvcc
CUDA_ARCH ?=
NVFLAGS ?= -std=c++17 -O2 -lineinfo -Xcompiler=-Wall,-Wextra,-Wpedantic
TARGET := build/candy-sssp-cuda
SOURCE := src/main.cu

ifeq ($(strip $(CUDA_ARCH)),)
$(error CUDA_ARCH is required; derive it from the trusted qualification device/toolkit)
endif

.PHONY: all clean fault-memory fault-launch

all: $(TARGET)

$(TARGET): $(SOURCE)
	@mkdir -p build
	$(NVCC) $(NVFLAGS) -arch=$(CUDA_ARCH) -DCANDY_QUALIFIED_ARCH=\"$(CUDA_ARCH)\" -o $@ $<

fault-memory: build/candy-sssp-cuda-fault-memory

build/candy-sssp-cuda-fault-memory: $(SOURCE)
	@mkdir -p build
	$(NVCC) $(NVFLAGS) -arch=$(CUDA_ARCH) -DCANDY_QUALIFIED_ARCH=\"$(CUDA_ARCH)\" -DCANDY_TEST_FORCE_MEMORY_REFUSAL=1 -o $@ $<

fault-launch: build/candy-sssp-cuda-fault-launch

build/candy-sssp-cuda-fault-launch: $(SOURCE)
	@mkdir -p build
	$(NVCC) $(NVFLAGS) -arch=$(CUDA_ARCH) -DCANDY_QUALIFIED_ARCH=\"$(CUDA_ARCH)\" -DCANDY_TEST_FORCE_LAUNCH_FAILURE=1 -o $@ $<

clean:
	rm -rf build
