# Root Makefile for MYCA
.PHONY: all test clean hil bench

all: test

test:
	$(MAKE) -C core/kernel test

hil:
	$(MAKE) -C core/kernel hil

bench:
	$(MAKE) -C core/kernel bench

clean:
	$(MAKE) -C core/kernel clean
