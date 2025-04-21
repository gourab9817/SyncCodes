import React, { useEffect, useRef, useState } from "react";
import "codemirror/mode/javascript/javascript";
import "codemirror/theme/dracula.css";
import "codemirror/addon/edit/closetag";
import "codemirror/addon/edit/closebrackets";
import "codemirror/lib/codemirror.css";
import CodeMirror from "codemirror";
import "codemirror/mode/python/python";
import "codemirror/mode/clike/clike";
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

function Editor({ socket, roomId, onCodeChange }) {
  const editorRef = useRef(null);
  const textareaRef = useRef(null);
  const code = useRef("");
  const [open, setOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("javascript");
  const [output, setOutput] = useState("your code output comes here...");

  // Initialize CodeMirror only once.
  useEffect(() => {
    if (editorRef.current) {
      return;
    }
    async function init() {
      editorRef.current = CodeMirror.fromTextArea(textareaRef.current, {
        mode: { name: "javascript", json: true },
        theme: "dracula",
        autoCloseBrackets: true,
        autoCloseTags: true,
        autocorrect: true,
        lineNumbers: true,
      });
      editorRef.current.setSize("100%", "h-full");
      editorRef.current.setValue(CODE_SNIPPETS[selectedLanguage]);
      code.current = CODE_SNIPPETS[selectedLanguage];

      editorRef.current.on("change", (instance, changes) => {
        const { origin } = changes;
        if (origin !== "setValue") {
          const currentCode = instance.getValue();
          code.current = currentCode;
          console.log(currentCode);
          onCodeChange(currentCode);
          socket.emit("code:change", { roomId, code: currentCode });
        }
      });
    }
    init();

    // Cleanup: remove CodeMirror instance on unmount.
    return () => {
      if (editorRef.current) {
        editorRef.current.toTextArea();
        editorRef.current = null;
      }
    };
    // We want to initialize CodeMirror only once; disabling exhaustive-deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Socket listeners for code change and output.
  useEffect(() => {
    const handleCodeChange = ({ code }) => {
      if (editorRef.current && code) {
        editorRef.current.setValue(code);
      }
    };

    const handleDisconnect = ({ socketId, email }) => {
      toast.success(`${email} disconnected`);
    };

    socket.on("output", ({ output }) => {
      setOutput(output);
    });
    socket.on("code:change", handleCodeChange);
    socket.on("disconnected", handleDisconnect);

    return () => {
      socket.off("code:change", handleCodeChange);
      socket.off("disconnected", handleDisconnect);
      socket.off("output");
    };
  }, [socket, roomId]);

  const handleExecuteCode = async () => {
    try {
      const result = await executeCode({
        language: selectedLanguage,
        sourceCode: code.current,
      });
      console.log("Execution result:", result);
      setOutput(result.run.output);
      socket.emit("output", { roomId, output: result.run.output });
    } catch (error) {
      toast.error("Failed to execute code: " + error.message);
      setOutput(error.message);
      socket.emit("output", { roomId, output: error.message });
    }
  };

  // Setup language change listener.
  useEffect(() => {
    socket.emit("output", { roomId, output });
    const handleLanguageChange = ({ language, snippet }) => {
      console.log(snippet);
      if (LANGUAGE_MODES[language]) {
        setSelectedLanguage(language);
        editorRef.current.setOption("mode", LANGUAGE_MODES[language]);
        editorRef.current.setValue(snippet);
        code.current = snippet;
        console.log(snippet);
      }
    };
    socket.on("language:change", handleLanguageChange);
    return () => {
      socket.off("language:change", handleLanguageChange);
    };
  }, [socket, roomId, output]);

  const handleClickOpen = () => {
    setOpen(true);
  };
  const handleClose = () => {
    setOpen(false);
  };

  const handleSelectLanguage = (event) => {
    const language = event.target.value;
    setSelectedLanguage(language);
    const mode = LANGUAGE_MODES[language];
    if (mode) {
      editorRef.current.setOption("mode", mode);
      editorRef.current.setValue(CODE_SNIPPETS[language]);
      code.current = CODE_SNIPPETS[language];
      console.log("Mode set to:", mode);
      socket.emit("language:change", {
        roomId,
        language,
        snippet: CODE_SNIPPETS[language],
      });
    } else {
      console.error("Invalid mode for language:", language);
    }
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
            gap: "4px"
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
              {Object.keys(LANGUAGE_VERSIONS).map((language) => (
                <MenuItem key={language} value={language}>
                  {language}
                </MenuItem>
              ))}
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