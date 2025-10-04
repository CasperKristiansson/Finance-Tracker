
.PHONY: build clean

ROOT_DIR := $(shell git rev-parse --show-toplevel)
LAYER_DIR := $(ROOT_DIR)/infra/layers
IMAGE_NAME ?= finance-tracker-backend-layer
LAYER_ZIP ?= layer-backend.zip
DOCKERFILE ?= Dockerfile

build:
	docker build --platform linux/amd64 -t $(IMAGE_NAME) -f $(LAYER_DIR)/$(DOCKERFILE) $(ROOT_DIR)
	docker run --platform linux/amd64 --rm --entrypoint "" -v $(LAYER_DIR):/output $(IMAGE_NAME) cp /layer/$(LAYER_ZIP) /output/

clean:
	rm -f $(LAYER_DIR)/$(LAYER_ZIP)
