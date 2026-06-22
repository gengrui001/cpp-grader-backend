$file = "C:\Users\Administrator\Documents\Codex\2026-06-12\new-chat\work\cpp-grader\server.js"
$content = [System.IO.File]::ReadAllText($file)

# Replace corrupted path with correct one
$oldPath = "C:/Users/Administrator/Desktop/????? (3)/w64devkit/bin/g++.exe"
$newPath = "C:/Users/Administrator/Desktop/新建文件夹 (3)/w64devkit/bin/g++.exe"

if ($content.Contains($oldPath)) {
    $content = $content.Replace($oldPath, $newPath)
    [System.IO.File]::WriteAllText($file, $content)
    Write-Host "Fixed path in server.js"
} else {
    Write-Host "Could not find old path in server.js"
    $idx = $content.IndexOf("Desktop")
    if ($idx -ge 0) { Write-Host $content.Substring($idx, 80) }
}
