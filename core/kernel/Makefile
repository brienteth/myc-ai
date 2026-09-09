# ============================================================================
# MYCA C99 Deterministic Core & Security Verification Suite
# ============================================================================

CC ?= clang
HOST_CFLAGS ?= -O3 -std=c99 -Wall -Wextra -I. -DHOST_BENCH
FIRMWARE_CFLAGS ?= -O3 -std=c99 -Wall -Wextra -I.

.PHONY: all test bench hil lib clean

all: test bench hil lib

test:
	$(CC) $(HOST_CFLAGS) test_s1_s17.c myc_core.c -o test_s1_s17
	./test_s1_s17

bench:
	$(CC) $(HOST_CFLAGS) test_real_bench.c myc_core.c -o myca_bench
	./myca_bench

hil:
	$(CC) $(HOST_CFLAGS) hil_physical_pen_test.c myc_core.c -o hil_test
	./hil_test

lib:
	$(CC) $(FIRMWARE_CFLAGS) -c myc_core.c -o myca_core.o
	ar rcs libmyca_core.a myca_core.o

clean:
	rm -f test_s1_s17 myca_bench hil_test myca_core.o libmyca_core.a
