#Requires AutoHotkey v2.0
#SingleInstance Force
#Warn

; GX Works3 CSV file-dialog helper. No PLC/online functions are used here.
; Arguments: mode(import|export), absoluteCsvPath, action(probe|fill|submit), statusFile, waitSeconds
SetTitleMatchMode(2)

statusFile := A_Args.Length >= 4 ? A_Args[4] : A_ScriptDir "\file_dialog_status.txt"
gxPid := 0
expectedTitle := ""
dialogHwnd := 0
target := ""
csvPath := ""
stage := "argument validation"

try {
    if (A_Args.Length < 3)
        throw Error("Expected: import|export CSV_PATH probe|fill|submit [STATUS_FILE] [WAIT_SECONDS]")

    mode := StrLower(A_Args[1])
    csvPath := A_Args[2]
    action := StrLower(A_Args[3])
    waitSeconds := A_Args.Length >= 5 ? (A_Args[5] + 0) : 75

    if (mode != "import" && mode != "export")
        throw Error("Unsupported mode: " mode)
    if (action != "probe" && action != "fill" && action != "submit")
        throw Error("Unsupported action: " action)
    if (waitSeconds < 1 || waitSeconds > 180)
        throw Error("Wait time must be 1 to 180 seconds")
    if !RegExMatch(csvPath, "i)^[A-Z]:\\")
        throw Error("CSV path must be an absolute local Windows path")
    if !RegExMatch(csvPath, "i)\.csv$")
        throw Error("Expected a .csv file")
    if (action != "probe") {
        if (mode = "import" && (!FileExist(csvPath) || InStr(FileExist(csvPath), "D")))
            throw Error("Import CSV does not exist")
        if (mode = "export" && FileExist(csvPath))
            throw Error("Export CSV already exists; refusing overwrite")
        if (mode = "export") {
            SplitPath(csvPath, &fileName, &parentDir)
            if !DirExist(parentDir)
                throw Error("Export destination directory does not exist")
        }
    }

    expectedTitle := mode = "import" ? "インポート" : "エクスポート"
    WriteStatus(statusFile, "WAITING", "AHK started; mode=" mode "; dialog=" expectedTitle "; action=" action "; waitSeconds=" waitSeconds)
    stage := "GX Works3 process identification"
    gxPid := FindGXWorks3PID()
    WriteStatus(statusFile, "WAITING", "GX PID=" gxPid "; dialog=" expectedTitle "; action=" action "; waitSeconds=" waitSeconds)

    stage := "file dialog detection"
    dialogHwnd := WaitForGXDialog(gxPid, expectedTitle, waitSeconds)
    target := "ahk_id " dialogHwnd
    WriteStatus(statusFile, "DETECTED", "dialog=" expectedTitle "; hwnd=" dialogHwnd, GetDiagnostics(gxPid, expectedTitle, dialogHwnd, target))
    if (action = "probe") {
        WriteStatus(statusFile, "PROBED", "Target GX Works3 file dialog found; no UI operation performed", GetDiagnostics(gxPid, expectedTitle, dialogHwnd, target))
        ExitApp(0)
    }

    stage := "dialog activation"
    FocusDialog(target)
    stage := "filename focus"
    filenameFocus := FocusFilenameControl(target)
    stage := "filename population"
    SetFilename(filenameFocus["Control"], filenameFocus["Hwnd"], csvPath)
    WriteStatus(
        statusFile,
        "FILLED",
        "Filename field populated: " csvPath "; control=" filenameFocus["Control"] "; method=" filenameFocus["Method"],
        GetDiagnostics(gxPid, expectedTitle, dialogHwnd, target)
    )

    if (action = "fill")
        ExitApp(0)

    ; Only submit mode presses Enter. The caller must authorize this explicitly.
    ; Re-check path constraints immediately before submitting.
    if (mode = "export" && FileExist(csvPath))
        throw Error("Export destination appeared after filling; refusing overwrite")
    if !WinActive(target)
        throw Error("Dialog is no longer active; refusing to submit")
    Send("{Enter}")
    if !WinWaitClose(target, , 8)
        throw Error("Dialog did not close after pressing Enter; verify GUI manually")

    if (mode = "export") {
        found := false
        Loop 30 {
            if FileExist(csvPath) {
                found := true
                break
            }
            Sleep(200)
        }
        if !found
            throw Error("Dialog closed, but export file was not found")
        WriteStatus(statusFile, "SAVED", "Export file created: " csvPath)
    } else {
        ; Closing the picker does not prove GX accepted the imported settings.
        WriteStatus(statusFile, "FILE_SELECTED", "Import picker closed; verify GX warnings and re-export station list")
    }
} catch Error as err {
    WriteStatus(statusFile, "ERROR", "stage=" stage "; " err.Message)
    try {
        WriteStatus(statusFile, "ERROR", "stage=" stage "; " err.Message, GetDiagnostics(gxPid, expectedTitle, dialogHwnd, target))
    } catch Error as diagnosticError {
        WriteStatus(statusFile, "ERROR", "stage=" stage "; " err.Message "; diagnostics failed: " diagnosticError.Message)
    }
    ExitApp(1)
}
ExitApp(0)

FindGXWorks3PID() {
    pids := Map()
    for hwnd in WinGetList("MELSOFT GX Works3") {
        title := WinGetTitle("ahk_id " hwnd)
        if InStr(title, "MELSOFT GX Works3") {
            pid := WinGetPID("ahk_id " hwnd)
            pids[pid] := true
        }
    }
    if (pids.Count != 1)
        throw Error("Expected exactly one running GX Works3 process; found " pids.Count)
    for pid, ignored in pids
        return pid
}

WaitForGXDialog(expectedPid, expectedTitle, timeoutSeconds) {
    deadline := A_TickCount + timeoutSeconds * 1000
    while (A_TickCount < deadline) {
        matches := []
        for hwnd in WinGetList("ahk_class #32770") {
            if (WinGetPID("ahk_id " hwnd) != expectedPid)
                continue
            if (WinGetTitle("ahk_id " hwnd) = expectedTitle)
                matches.Push(hwnd)
        }
        if (matches.Length > 1)
            throw Error("Multiple matching file dialogs found; refusing ambiguous action")
        if (matches.Length = 1)
            return matches[1]
        Sleep(250)
    }
    throw Error("Timed out waiting for GX Works3 '" expectedTitle "' dialog")
}

FocusDialog(target) {
    if !WinWait(target, , 2)
        throw Error("Identified dialog disappeared before activation")
    WinActivate(target)
    if !WinWaitActive(target, , 5)
        throw Error("Could not activate the identified GX Works3 file dialog")
}

FocusFilenameControl(target) {
    global stage
    stage := "filename focus: enumerate controls"
    directEdits := []
    for controlName in WinGetControls(target) {
        if !RegExMatch(controlName, "i)^Edit\d+$")
            continue
        stage := "filename focus: inspect " controlName
        controlHwnd := ControlGetHwnd(controlName, target)
        directEdits.Push(controlName)
    }

    directFocusError := ""
    if (directEdits.Length = 1) {
        try {
            stage := "filename focus: direct ControlFocus"
            directHwnd := ControlGetHwnd(directEdits[1], target)
            ControlFocus(directHwnd, target)
            Sleep(150)
            stage := "filename focus: verify direct focus"
            focusedHwnd := ControlGetFocus(target)
            if (focusedHwnd = directHwnd)
                return Map("Control", directEdits[1], "Hwnd", focusedHwnd, "Method", "ControlFocus")
        } catch Error as focusException {
            directFocusError := focusException.Message
        }
    }

    if !WinActive(target) {
        stage := "filename focus: reactivate dialog"
        WinActivate(target)
        if !WinWaitActive(target, , 5)
            throw Error("Dialog lost activation before filename fallback")
    }

    stage := "filename focus: Alt+N"
    Send("!n")
    Sleep(250)
    stage := "filename focus: resolve focused control"
    focusedHwnd := ControlGetFocus(target)
    focused := ResolveFocusedControl(target, focusedHwnd)
    if !focused
        throw Error("No filename control mapped after ControlFocus and Alt+N; focused HWND=" focusedHwnd)

    stage := "filename focus: verify focused control class"
    focusedClass := WinGetClass("ahk_id " focusedHwnd)
    if (focusedClass != "Edit" && focusedClass != "ComboBox")
        throw Error("Alt+N focused a non-text control: " focused "; class=" focusedClass)

    method := directEdits.Length = 0 ? "Alt+N" : "Alt+N fallback"
    if (directFocusError != "")
        method .= "; ControlFocus error=" directFocusError
    return Map("Control", focused, "Hwnd", focusedHwnd, "Method", method)
}

ResolveFocusedControl(target, focused) {
    if !focused
        return ""
    ; ControlGetFocus returns a child HWND, not a ClassNN name.
    for controlName in WinGetControls(target) {
        if !RegExMatch(controlName, "i)^(Edit|ComboBox)\d+$")
            continue
        try {
            controlHwnd := ControlGetHwnd(controlName, target)
            if (controlName = focused || controlHwnd = focused)
                return controlName
        } catch Error as controlException {
            continue
        }
    }
    return ""
}

SetFilename(controlName, controlHwnd, csvPath) {
    try {
        ControlSetText(csvPath, controlHwnd)
    } catch Error as setTextException {
        throw Error("ControlSetText failed for " controlName " HWND=" controlHwnd ": " setTextException.Message)
    }
    Sleep(150)
    try {
        actual := ControlGetText(controlHwnd)
    } catch Error as getTextException {
        throw Error("ControlGetText failed for " controlName " HWND=" controlHwnd ": " getTextException.Message)
    }
    if (actual != csvPath)
        throw Error("Filename field verification failed; expected=" csvPath "; actual=" actual)
}

GetDiagnostics(expectedPid := 0, expectedTitle := "", dialogHwnd := 0, target := "") {
    lines := []
    lines.Push("EXPECTED_GX_PID=" expectedPid)
    lines.Push("EXPECTED_DIALOG_TITLE=" expectedTitle)

    if (dialogHwnd) {
        lines.Push("DIALOG_HWND=" dialogHwnd)
        try lines.Push("DIALOG_TITLE=" WinGetTitle("ahk_id " dialogHwnd))
        try lines.Push("DIALOG_CLASS=" WinGetClass("ahk_id " dialogHwnd))
        try lines.Push("DIALOG_PID=" WinGetPID("ahk_id " dialogHwnd))
    }

    if (target != "") {
        try lines.Push("DIALOG_ACTIVE=" (WinActive(target) ? "yes" : "no"))
        try {
            focusedHwnd := ControlGetFocus(target)
            focusedControl := ResolveFocusedControl(target, focusedHwnd)
            lines.Push("FOCUSED_CONTROL=" (focusedControl != "" ? focusedControl : "<unmapped>") "; HWND=" focusedHwnd)
        }
        controlDescriptions := []
        for controlName in WinGetControls(target) {
            try {
                controlHwnd := ControlGetHwnd(controlName, target)
                controlClass := WinGetClass("ahk_id " controlHwnd)
                controlText := ControlGetText(controlName, target)
                controlText := StrReplace(StrReplace(controlText, "`r", " "), "`n", " ")
                if (StrLen(controlText) > 80)
                    controlText := SubStr(controlText, 1, 77) "..."
                controlDescriptions.Push(controlName "{" controlClass "}=[" controlText "]")
            } catch Error as controlException {
                controlDescriptions.Push(controlName "{unresolved}=[" controlException.Message "]")
            }
        }
        if (controlDescriptions.Length)
            lines.Push("CONTROLS=" JoinLines(controlDescriptions, " | "))
    }

    dialogs := []
    try {
        for hwnd in WinGetList("ahk_class #32770") {
            pid := WinGetPID("ahk_id " hwnd)
            if (expectedPid && pid != expectedPid)
                continue
            title := WinGetTitle("ahk_id " hwnd)
            className := WinGetClass("ahk_id " hwnd)
            dialogs.Push("hwnd=" hwnd ";pid=" pid ";class=" className ";title=[" title "]")
        }
    }
    if (dialogs.Length)
        lines.Push("GX_DIALOG_CANDIDATES=" JoinLines(dialogs, " | "))

    return JoinLines(lines, "`n")
}

JoinLines(lines, separator := "`n") {
    result := ""
    for line in lines
        result .= (result = "" ? "" : separator) line
    return result
}

WriteStatus(filePath, state, details, diagnostics := "") {
    details := StrReplace(StrReplace(details, "`r", " "), "`n", " ")
    contents := "STATUS=" state "`nDETAILS=" details "`n"
    if (diagnostics != "")
        contents .= "DIAGNOSTICS_BEGIN`n" diagnostics "`nDIAGNOSTICS_END`n"
    contents .= "TIME=" A_Now "`n"
    if FileExist(filePath)
        FileDelete(filePath)
    FileAppend(contents, filePath, "UTF-8")
}
