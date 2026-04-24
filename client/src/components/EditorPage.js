import React, { useEffect, useRef, useState } from "react";
import "codemirror/mode/javascript/javascript";
import "codemirror/theme/dracula.css";
import "codemirror/addon/edit/closetag";
import "codemirror/addon/edit/closebrackets";
import "codemirror/lib/codemirror.css";
import CodeMirror from "codemirror";
import "codemirror/mode/python/python";
import "codemirror/mode/clike/clike";
import "codemirror/mode/go/go";
import "codemirror/mode/rust/rust";
import toast, { Toaster } from "react-hot-toast";
import { Play, ChevronDown } from "lucide-react";
import { executeCode } from "./ExecuteCode";
import {
  LANGUAGE_VERSIONS,
  CODE_SNIPPETS,
  LANGUAGE_MODES,
} from "../constants/constant";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
} from "@mui/material";
import * as Y from "yjs";
import { CodemirrorBinding } from "y-codemirror";

const SOCKET_ORIGIN = "socket-remote";

function Editor({ socket, roomId, onCodeChange }) {
  const textareaRef = useRef(null);
  const editorRef = useRef(null);
  const bindingRef = useRef(null);
  const ydocRef = useRef(null);
  const ytextRef = useRef(null);
  const code = useRef("");
  const selectedLanguageRef = useRef("javascript");
  const onCodeChangeRef = useRef(onCodeChange);
  onCodeChangeRef.current = onCodeChange;

  const [open, setOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("javascript");
  const [output, setOutput] = useState("your code output comes here...");

  useEffect(() => {
    selectedLanguageRef.current = selectedLanguage;
  }, [selectedLanguage]);

  useEffect(() => {
    if (!socket || !roomId || !textareaRef.current) return undefined;

    let cancelled = false;
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("codemirror");
    ydocRef.current = ydoc;
    ytextRef.current = ytext;

    const pushCodeRef = () => {
      const s = ytext.toString();
      code.current = s;
      onCodeChangeRef.current?.(s);
    };

    const onYTextChange = () => {
      if (!cancelled) pushCodeRef();
    };
    ytext.observe(onYTextChange);

    const onYjsRemoteUpdate = ({ update }) => {
      if (cancelled || !update?.length) return;
      try {
        Y.applyUpdate(ydoc, new Uint8Array(update), SOCKET_ORIGIN);
      } catch (e) {
        console.warn("yjs:update apply failed", e);
      }
    };

    const forwardOutgoing = (update, origin) => {
      if (cancelled || origin === SOCKET_ORIGIN || !update?.length) return;
      socket.emit("yjs:update", { roomId, update: Array.from(update) });
    };
    ydoc.on("update", forwardOutgoing);

    let initDone = false;
    const initEditor = () => {
      if (cancelled || initDone || editorRef.current) return;
      initDone = true;

      const cm = CodeMirror.fromTextArea(textareaRef.current, {
        mode: { name: "javascript", json: true },
        theme: "dracula",
        autoCloseBrackets: true,
        autoCloseTags: true,
        autocorrect: true,
        lineNumbers: true,
      });
      editorRef.current = cm;
      cm.setSize("100%", "h-full");

      const binding = new CodemirrorBinding(ytext, cm);
      bindingRef.current = binding;

      pushCodeRef();
    };

    const scheduleInit = () => {
      if (cancelled || initDone) return;
      if (ytext.length === 0) {
        const lang = selectedLanguageRef.current;
        const snippet = CODE_SNIPPETS[lang] || "";
        ydoc.transact(() => ytext.insert(0, snippet), "seed");
      }
      initEditor();
    };

    const onSyncResponse = ({ state }) => {
      if (cancelled || !state?.length) return;
      clearTimeout(initTimer);
      try {
        Y.applyUpdate(ydoc, new Uint8Array(state), SOCKET_ORIGIN);
      } catch (e) {
        console.warn("yjs:sync-response apply failed", e);
      }
      scheduleInit();
    };

    const onSyncRequest = ({ requesterId }) => {
      if (cancelled || !requesterId || ytext.length === 0) return;
      try {
        const state = Array.from(Y.encodeStateAsUpdate(ydoc));
        socket.emit("yjs:sync-response", { requesterId, state });
      } catch (e) {
        console.warn("yjs:sync-response encode failed", e);
      }
    };

    const initTimer = setTimeout(() => {
      scheduleInit();
    }, 500);

    socket.on("yjs:update", onYjsRemoteUpdate);
    socket.on("yjs:sync-response", onSyncResponse);
    socket.on("yjs:sync-request", onSyncRequest);
    socket.emit("yjs:sync-request", { roomId });

    return () => {
      cancelled = true;
      clearTimeout(initTimer);
      socket.off("yjs:update", onYjsRemoteUpdate);
      socket.off("yjs:sync-response", onSyncResponse);
      socket.off("yjs:sync-request", onSyncRequest);
      ydoc.off("update", forwardOutgoing);
      ytext.unobserve(onYTextChange);

      if (bindingRef.current) {
        try {
          bindingRef.current.destroy();
        } catch (_) {
          /* noop */
        }
        bindingRef.current = null;
      }
      if (editorRef.current) {
        try {
          editorRef.current.toTextArea();
        } catch (_) {
          /* noop */
        }
        editorRef.current = null;
      }
      ydoc.destroy();
      ydocRef.current = null;
      ytextRef.current = null;
    };
  }, [socket, roomId]);

  useEffect(() => {
    if (!socket) return;
    const handleOutput = ({ output: out }) => setOutput(out);
    socket.on("output", handleOutput);
    return () => socket.off("output", handleOutput);
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    const handleLanguageChange = ({ language }) => {
      const mode = LANGUAGE_MODES[language];
      if (!mode || !editorRef.current) return;
      setSelectedLanguage(language);
      selectedLanguageRef.current = language;
      editorRef.current.setOption("mode", mode);
    };
    socket.on("language:change", handleLanguageChange);
    return () => socket.off("language:change", handleLanguageChange);
  }, [socket]);

  const handleExecuteCode = async () => {
    const source =
      ytextRef.current?.toString() ?? editorRef.current?.getValue() ?? code.current;
    try {
      const result = await executeCode({
        language: selectedLanguage,
        sourceCode: source,
      });
      const run = result?.run || {};
      const text =
        [run.output, run.stderr].filter(Boolean).join("\n").trim() ||
        "No output";
      setOutput(text);
      socket.emit("output", { roomId, output: text });
    } catch (error) {
      toast.error("Failed to execute code: " + error.message);
      setOutput(error.message);
      socket.emit("output", { roomId, output: error.message });
    }
  };

  const handleClickOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const handleSelectLanguage = (event) => {
    const language = event.target.value;
    if (!language || !editorRef.current || !ydocRef.current || !ytextRef.current) return;

    const mode = LANGUAGE_MODES[language];
    const snippet = CODE_SNIPPETS[language];
    if (!mode || !snippet) {
      toast.error(`Language not supported: ${language}`);
      return;
    }

    const ydoc = ydocRef.current;
    const ytext = ytextRef.current;

    ydoc.transact(() => {
      ytext.delete(0, ytext.length);
      ytext.insert(0, snippet);
    }, "language");

    setSelectedLanguage(language);
    selectedLanguageRef.current = language;
    editorRef.current.setOption("mode", mode);
    socket.emit("language:change", { roomId, language });
  };

  return (
    <div className="h-full w-full">
      <Toaster />
      <textarea ref={textareaRef} className="h-full w-full" />
      <div className="flex justify-center items-center">
        <Button
          variant="contained"
          sx={{
            backgroundColor: "#7e57c2",
            marginTop: "4px",
            color: "white",
            border: "none",
            "&:hover": { backgroundColor: "#6a45b9" },
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
          onClick={handleClickOpen}
        >
          {selectedLanguage || "Select Language"}
          <ChevronDown size={16} />
        </Button>
        <Dialog open={open} onClose={handleClose}>
          <DialogTitle>Select a Language</DialogTitle>
          <DialogContent>
            <Select
              value={selectedLanguage}
              onChange={handleSelectLanguage}
              displayEmpty
              fullWidth
            >
              <MenuItem value="" disabled>
                Select a language
              </MenuItem>
              {Object.keys(LANGUAGE_VERSIONS).map((language) => {
                const labels = {
                  cpp: "C++",
                  c: "C",
                  javascript: "JavaScript",
                  go: "Go",
                  rust: "Rust",
                  java: "Java",
                  python: "Python",
                };
                return (
                  <MenuItem key={language} value={language}>
                    {labels[language] ||
                      language.charAt(0).toUpperCase() + language.slice(1)}
                  </MenuItem>
                );
              })}
            </Select>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Close</Button>
          </DialogActions>
        </Dialog>

        <p className="text-black font-bold m-2">Execute Code:</p>
        <Play
          onClick={handleExecuteCode}
          size={"2rem"}
          className="bg-indigo-600 hover:bg-indigo-700 border rounded-full p-1 text-white cursor-pointer"
        />
      </div>
      <p className="text-black">Output:</p>
      <div className="w-full bg-gray-800 text-white p-2 my-4 h-36 overflow-y-hidden">
        <pre>{output}</pre>
      </div>
    </div>
  );
}

export default Editor;
