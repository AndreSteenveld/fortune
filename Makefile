# Commands
COMPILE_CMD = node_modules/.bin/babel
LINT_CMD = node_modules/.bin/eslint

# Directories
LIB_DIR = lib/
DIST_DIR = dist/
TEST_DIR = test/

.PHONY: all lint compile-lib compile-dist compile-test clean

all: compile-lib compile-test

lint:
	$(LINT_CMD) $(LIB_DIR) $(TEST_DIR)

compile-lib:
	mkdir -p $(DIST_DIR)$(LIB_DIR)
	$(COMPILE_CMD) --optional runtime $(LIB_DIR) \
		--out-dir $(DIST_DIR)$(LIB_DIR)

compile-dist:
	mkdir -p $(DIST_DIR)
	$(COMPILE_CMD) --optional runtime $(LIB_DIR) \
		--out-dir $(DIST_DIR)

compile-test:
	mkdir -p $(DIST_DIR)$(TEST_DIR)
	$(COMPILE_CMD) --optional runtime $(TEST_DIR) \
		--out-dir $(DIST_DIR)$(TEST_DIR)

clean:
	rm -rf $(DIST_DIR) coverage/
