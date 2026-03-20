$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open('C:\Users\v.grabowski\Downloads\items_v2_familles_seeds.xlsx')
$sheets = @()
foreach($sheet in $wb.Sheets) {
    $sheets += $sheet.Name
}
$sheets | ConvertTo-Json | Out-File -FilePath 'C:\Users\v.grabowski\OneDrive - Betclic Group\Documents\GAMEJAM\Dofus-Like\sheet_names.json'
$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel)
