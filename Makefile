CXX := c++
SDKROOT := $(shell xcrun --show-sdk-path 2>/dev/null)
CPP_INCLUDE := $(if $(SDKROOT),-isystem $(SDKROOT)/usr/include/c++/v1)
CXXFLAGS := -std=c++20 -O2 -Wall -Wextra -Wshadow -Wconversion -DLOCAL $(CPP_INCLUDE)
SRC ?= template.cpp
BIN := bin/main

.PHONY: run build test clean new

build:
	@mkdir -p bin
	$(CXX) $(CXXFLAGS) $(SRC) -o $(BIN)

run: build
	./$(BIN) < input.txt > output.txt
	@echo "Wrote output.txt"

test:
	./test.sh $(SRC)

clean:
	rm -rf bin

new:
	@if [ -z "$(NAME)" ]; then echo "Usage: make new NAME=problems/b.cpp"; exit 1; fi
	@cp template.cpp $(NAME)
	@mkdir -p tests/$$(basename $(NAME) .cpp)
	@echo "Created $(NAME)"
