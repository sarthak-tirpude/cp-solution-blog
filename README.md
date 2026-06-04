# Codeforces C++ Workspace

Quick commands:

```sh
make run
```

Run sample tests:

```sh
make test
```

By default, `make run` compiles `template.cpp`, reads `input.txt`, and writes
the result to `output.txt`.

Run a specific file:

```sh
make run SRC=problems/b.cpp
./run.sh problems/b.cpp
make test SRC=problems/b.cpp
```

Create a new problem file from `template.cpp`:

```sh
make new NAME=problems/b.cpp
```

Use `input.txt` for local tests. Output is written to `output.txt`.

For multiple sample tests, add files like:

```text
tests/a/1.in
tests/a/1.out
tests/a/2.in
tests/a/2.out
```

Then run:

```sh
make test SRC=problems/a.cpp
```

The template uses portable standard headers so it compiles cleanly on macOS and
is still accepted by Codeforces.

On this machine the scripts also add the macOS SDK libc++ include path, because
the default compiler search path does not include it.
