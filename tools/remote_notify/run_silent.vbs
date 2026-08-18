' Silent Runner for Remote Notify Listener
' Runs mqtt_listener.py in background without window

Set objShell = CreateObject("Wscript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptPath = Wscript.ScriptFullName
scriptDir = fso.GetParentFolderName(scriptPath)
scriptFile = scriptDir & "\mqtt_listener.py"
logFile = scriptDir & "\listener.log"

pythonPath = ""

Function FindPython()
    Dim tempFile, result
    tempFile = scriptDir & "\pytemp.txt"
    
    ' Try py command
    On Error Resume Next
    objShell.Run "py -c ""import sys; print(sys.executable)"" > """ & tempFile & """", 0, True
    On Error GoTo 0
    
    If fso.FileExists(tempFile) Then
        Set ts = fso.OpenTextFile(tempFile, 1)
        If Not ts.AtEndOfStream Then
            result = Trim(ts.ReadLine())
        End If
        ts.Close
        fso.DeleteFile(tempFile)
        If Len(result) > 0 Then
            FindPython = result
            Exit Function
        End If
    End If
    
    ' Try python command
    On Error Resume Next
    objShell.Run "python -c ""import sys; print(sys.executable)"" > """ & tempFile & """", 0, True
    On Error GoTo 0
    
    If fso.FileExists(tempFile) Then
        Set ts = fso.OpenTextFile(tempFile, 1)
        If Not ts.AtEndOfStream Then
            result = Trim(ts.ReadLine())
        End If
        ts.Close
        fso.DeleteFile(tempFile)
        If Len(result) > 0 Then
            FindPython = result
            Exit Function
        End If
    End If
    
    ' Fallback to common paths
    Dim userProfile
    userProfile = objShell.ExpandEnvironmentStrings("%USERNAME%")
    If fso.FileExists("C:\Users\" & userProfile & "\AppData\Local\Programs\Python\Python311\python.exe") Then
        FindPython = "C:\Users\" & userProfile & "\AppData\Local\Programs\Python\Python311\python.exe"
    ElseIf fso.FileExists("C:\Python311\python.exe") Then
        FindPython = "C:\Python311\python.exe"
    ElseIf fso.FileExists("C:\Users\" & userProfile & "\AppData\Local\Programs\Python\Python312\python.exe") Then
        FindPython = "C:\Users\" & userProfile & "\AppData\Local\Programs\Python\Python312\python.exe"
    ElseIf fso.FileExists("C:\Python312\python.exe") Then
        FindPython = "C:\Python312\python.exe"
    Else
        FindPython = ""
    End If
End Function

pythonPath = FindPython()

If Len(pythonPath) = 0 Then
    Wscript.Echo "Python not found. Please install Python 3.8+ first."
    Wscript.Quit 1
End If

' Try to use pythonw.exe (windowless version) if available
Dim pythonwPath
pythonwPath = Replace(pythonPath, "python.exe", "pythonw.exe")
If fso.FileExists(pythonwPath) Then
    pythonPath = pythonwPath
End If

dim command
dim quotedPath
dim quotedScript
quotedPath = Chr(34) & pythonPath & Chr(34)
quotedScript = Chr(34) & scriptFile & Chr(34)
command = quotedPath & " -u " & quotedScript

Set objLogFile = fso.CreateTextFile(logFile, True)
objLogFile.WriteLine "=============================================="
objLogFile.WriteLine "Remote Notify Listener Started"
objLogFile.WriteLine "Time: " & Now()
objLogFile.WriteLine "Python: " & pythonPath
objLogFile.WriteLine "Command: " & command
objLogFile.WriteLine "=============================================="
objLogFile.Close

' Use Run with hidden window (0), do not wait (False)
' This prevents the black console window from appearing
objShell.Run command & " >> """ & logFile & """ 2>&1", 0, False
