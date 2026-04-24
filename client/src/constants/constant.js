export const LANGUAGE_VERSIONS = {
  javascript: "18",
  python: "3",
  java: "17",
  c: "11",
  cpp: "17",
  go: "1.22",
  rust: "stable",
};

export const LANGUAGE_MODES = {
  javascript: "javascript",
  python: "python",
  java: "text/x-java",
  c: "text/x-csrc",
  cpp: "text/x-c++src",
  go: "go",
  rust: "rust",
};

export const CODE_SNIPPETS = {
  javascript: `\nfunction greet(name) {\n\tconsole.log("Hello, " + name + "!");\n}\n\ngreet("Alex");\n`,

  python: `\ndef greet(name):\n\tprint("Hello, " + name + "!")\n\ngreet("Alex")\n`,

  java: `\npublic class Main {\n\tpublic static void main(String[] args) {\n\t\tSystem.out.println("Hello from Java!");\n\t}\n}\n`,

  c: `#include <stdio.h>\n\nint main(void) {\n\tprintf("Hello from C!\\n");\n\treturn 0;\n}\n`,

  cpp: `#include <iostream>\n\nint main() {\n\tstd::cout << "Hello from C++!" << std::endl;\n\treturn 0;\n}\n`,

  go: `package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello from Go!")\n}\n`,

  rust: `fn main() {\n\tprintln!("Hello from Rust!");\n}\n`,
};
