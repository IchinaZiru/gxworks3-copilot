[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ArchivePath,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath,

    [string]$Model,

    [string]$EntryName
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression.FileSystem

$profileNamespace = 'http://cc-link.org/cspplus/ver4/'
$namespaceManagerPrefix = 'p'

function Get-ExactlyOneNode {
    param(
        [System.Xml.XmlDocument]$Xml,
        [System.Xml.XmlNamespaceManager]$NamespaceManager,
        [string]$XPath,
        [string]$Description
    )

    $nodes = $Xml.SelectNodes($XPath, $NamespaceManager)
    if ($nodes.Count -ne 1) {
        throw "$Description must match exactly one XML node; found $($nodes.Count). XPath: $XPath"
    }

    return $nodes[0]
}

function Get-OptionalItemText {
    param(
        [System.Xml.XmlNode]$Node,
        [System.Xml.XmlNamespaceManager]$NamespaceManager,
        [string]$ElementName
    )

    $item = $Node.SelectSingleNode("./$namespaceManagerPrefix`:$ElementName/$namespaceManagerPrefix`:item", $NamespaceManager)
    if ($null -eq $item) {
        return $null
    }

    return $item.InnerText.Trim()
}

function Get-ProfileItemText {
    param(
        [System.Xml.XmlDocument]$Xml,
        [System.Xml.XmlNamespaceManager]$NamespaceManager,
        [string]$XPath,
        [string]$Description
    )

    $item = Get-ExactlyOneNode -Xml $Xml -NamespaceManager $NamespaceManager -XPath $XPath -Description $Description
    return $item.InnerText.Trim()
}

function Get-ProfileItemTexts {
    param(
        [System.Xml.XmlDocument]$Xml,
        [System.Xml.XmlNamespaceManager]$NamespaceManager,
        [string]$XPath,
        [string]$Description
    )

    $items = $Xml.SelectNodes($XPath, $NamespaceManager)
    if ($items.Count -eq 0) {
        throw "$Description must match at least one XML node. XPath: $XPath"
    }

    return @($items | ForEach-Object { $_.InnerText.Trim() })
}

function Read-CspProfile {
    param([System.IO.Compression.ZipArchiveEntry]$Entry)

    $entryStream = $Entry.Open()
    try {
        $streamReader = New-Object System.IO.StreamReader($entryStream, [System.Text.Encoding]::UTF8, $true)
        try {
            $xmlText = $streamReader.ReadToEnd()
        }
        finally {
            $streamReader.Dispose()
        }
    }
    finally {
        if ($null -ne $entryStream) {
            $entryStream.Dispose()
        }
    }

    $settings = New-Object System.Xml.XmlReaderSettings
    $settings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
    $settings.XmlResolver = $null
    $textReader = New-Object System.IO.StringReader($xmlText)
    $xmlReader = [System.Xml.XmlReader]::Create($textReader, $settings)
    try {
        $xml = New-Object System.Xml.XmlDocument
        $xml.XmlResolver = $null
        $xml.Load($xmlReader)
    }
    finally {
        $xmlReader.Dispose()
        $textReader.Dispose()
    }

    if ($xml.DocumentElement.LocalName -ne 'profile' -or $xml.DocumentElement.NamespaceURI -ne $profileNamespace) {
        throw "Unexpected CSP+ root or namespace in $($Entry.FullName)"
    }

    $namespaceManager = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
    $namespaceManager.AddNamespace($namespaceManagerPrefix, $profileNamespace)
    $modelPath = '/p:profile/p:device/p:deviceInfo/p:deviceInfoMember[@label="DeviceModel"]/p:data/p:item'
    $specListPath = '/p:profile/p:device/p:deviceInfo/p:deviceInfoMember[@label="SpecList"]/p:data/p:item'
    return [pscustomobject]@{
        Entry = $Entry
        Xml = $xml
        NamespaceManager = $namespaceManager
        Model = Get-ProfileItemText -Xml $xml -NamespaceManager $namespaceManager -XPath $modelPath -Description 'DeviceModel'
        SpecList = Get-ProfileItemTexts -Xml $xml -NamespaceManager $namespaceManager -XPath $specListPath -Description 'SpecList'
    }
}

function Get-CspInfoValue {
    param(
        [pscustomobject]$Profile,
        [string]$Section,
        [string]$MemberLabel
    )

    $xpath = "/p:profile/p:$Section/p:$($Section)Info/p:$($Section)InfoMember[@label=`"$MemberLabel`"]/p:data/p:item"
    return Get-ProfileItemText -Xml $Profile.Xml -NamespaceManager $Profile.NamespaceManager -XPath $xpath -Description $MemberLabel
}

function Convert-ToCspInteger {
    param(
        [string]$Value,
        [string]$Label
    )

    [long]$parsed = 0
    $style = [System.Globalization.NumberStyles]::Integer
    $culture = [System.Globalization.CultureInfo]::InvariantCulture
    if (-not [long]::TryParse($Value, $style, $culture, [ref]$parsed)) {
        throw "CSP+ value for $Label is not an integer: '$Value'"
    }

    return $parsed
}

function Get-PointCountValue {
    param(
        [pscustomobject]$Profile,
        [string]$Label
    )

    $memberXPath = "/p:profile/p:commIf/p:commIfInfo/p:commIfInfoMember[@label=`"$Label`"]"
    $member = Get-ExactlyOneNode -Xml $Profile.Xml -NamespaceManager $Profile.NamespaceManager -XPath $memberXPath -Description $Label
    $dataXPath = "$memberXPath/p:data/p:item"
    $dataNode = Get-ExactlyOneNode -Xml $Profile.Xml -NamespaceManager $Profile.NamespaceManager -XPath $dataXPath -Description "$Label data"
    $name = Get-OptionalItemText -Node $member -NamespaceManager $Profile.NamespaceManager -ElementName 'name'
    $category = Get-OptionalItemText -Node $member -NamespaceManager $Profile.NamespaceManager -ElementName 'category'
    $datatype = Get-OptionalItemText -Node $member -NamespaceManager $Profile.NamespaceManager -ElementName 'datatype'
    $engineeringUnit = Get-OptionalItemText -Node $member -NamespaceManager $Profile.NamespaceManager -ElementName 'engUnit'

    return [ordered]@{
        label = $Label
        value = Convert-ToCspInteger -Value $dataNode.InnerText.Trim() -Label $Label
        xmlPath = $dataXPath
        xmlAttribute = [ordered]@{ name = 'label'; value = $Label }
        name = $name
        nameXmlPath = "$memberXPath/p:name/p:item"
        category = $category
        datatype = $datatype
        engineeringUnit = $engineeringUnit
    }
}

$archiveFullPath = [System.IO.Path]::GetFullPath($ArchivePath)
$outputFullPath = [System.IO.Path]::GetFullPath($OutputPath)
if ($archiveFullPath -eq $outputFullPath) {
    throw 'OutputPath must not overwrite the CSP+ archive.'
}
if (-not (Test-Path -LiteralPath $archiveFullPath -PathType Leaf)) {
    throw "CSP+ archive not found: $archiveFullPath"
}

$zip = [System.IO.Compression.ZipFile]::OpenRead($archiveFullPath)
try {
    $excludedEntries = @(
        $zip.Entries |
            Where-Object { $_.FullName -match '(?i)\(CCIEF\).*_ja\.cspp$' } |
            ForEach-Object { $_.FullName }
    )
    $candidateEntries = @(
        $zip.Entries |
            Where-Object {
                $_.FullName -match '(?i)_ja\.cspp$' -and
                $_.FullName -notmatch '(?i)\(CCIEF\)'
            }
    )
    if ($candidateEntries.Count -eq 0) {
        throw 'No Japanese CSP+ profile eligible for CC-Link IE TSN was found in the archive.'
    }

    $tsnProfiles = @()
    foreach ($entry in $candidateEntries) {
        $profile = Read-CspProfile -Entry $entry
        if (($profile.SpecList -join ' ') -match 'CC-Link IE TSN') {
            $tsnProfiles += $profile
        }
    }

    if ($Model) {
        $tsnProfiles = @($tsnProfiles | Where-Object { $_.Model -ceq $Model })
    }
    if ($EntryName) {
        $tsnProfiles = @($tsnProfiles | Where-Object { $_.Entry.FullName -ceq $EntryName -or $_.Entry.Name -ceq $EntryName })
    }
    if ($tsnProfiles.Count -ne 1) {
        $available = @($tsnProfiles | ForEach-Object { "$($_.Model):$($_.Entry.FullName)" }) -join ', '
        throw "Expected one Japanese CC-Link IE TSN profile; found $($tsnProfiles.Count). Specify -Model or -EntryName. Candidates: $available"
    }

    $profile = $tsnProfiles[0]
    $metadata = [ordered]@{
        deviceModel = [ordered]@{
            xmlPath = '/p:profile/p:device/p:deviceInfo/p:deviceInfoMember[@label="DeviceModel"]/p:data/p:item'
            value = $profile.Model
        }
        specList = [ordered]@{
            xmlPath = '/p:profile/p:device/p:deviceInfo/p:deviceInfoMember[@label="SpecList"]/p:data/p:item'
            value = @($profile.SpecList)
        }
        language = [ordered]@{
            xmlPath = '/p:profile/p:file/p:fileInfo/p:fileInfoMember[@label="Language"]/p:data/p:item'
            value = Get-CspInfoValue -Profile $profile -Section 'file' -MemberLabel 'Language'
        }
        ccLinkFamilyProfileVersion = [ordered]@{
            xmlPath = '/p:profile/p:file/p:fileInfo/p:fileInfoMember[@label="CCLinkFamilyProfileVersion"]/p:data/p:item'
            value = Get-CspInfoValue -Profile $profile -Section 'file' -MemberLabel 'CCLinkFamilyProfileVersion'
        }
        fileVersion = [ordered]@{
            xmlPath = '/p:profile/p:file/p:fileInfo/p:fileInfoMember[@label="FileVersion"]/p:data/p:item'
            value = Get-CspInfoValue -Profile $profile -Section 'file' -MemberLabel 'FileVersion'
        }
    }
    if ($metadata.language.value -ne 'ja') {
        throw "Selected profile is not Japanese: $($profile.Entry.FullName)"
    }

    $bitText = [string]::Concat([char]0x30D3, [char]0x30C3, [char]0x30C8)
    $wordText = [string]::Concat([char]0x30EF, [char]0x30FC, [char]0x30C9)
    $mapping = [ordered]@{
        RX = [ordered]@{ prefix = 'S_B'; unit = 'bit'; unitText = $bitText }
        RY = [ordered]@{ prefix = 'R_B'; unit = 'bit'; unitText = $bitText }
        RWr = [ordered]@{ prefix = 'S_W'; unit = 'word'; unitText = $wordText }
        RWw = [ordered]@{ prefix = 'R_W'; unit = 'word'; unitText = $wordText }
    }
    $parameters = [ordered]@{}
    foreach ($parameterName in $mapping.Keys) {
        $definition = $mapping[$parameterName]
        $labels = [ordered]@{
            initial = "$($definition.prefix)_DefaultSize"
            minimum = "$($definition.prefix)_MinSize"
            maximum = "$($definition.prefix)_MaxSize"
        }
        $source = [ordered]@{}
        foreach ($boundName in $labels.Keys) {
            $source[$boundName] = Get-PointCountValue -Profile $profile -Label $labels[$boundName]
        }

        $initial = $source.initial.value
        $minimum = $source.minimum.value
        $maximum = $source.maximum.value
        if ($minimum -gt $maximum) {
            throw "$parameterName has minimum $minimum greater than maximum $maximum."
        }
        if ($initial -lt $minimum -or $initial -gt $maximum) {
            throw "$parameterName initial value $initial is outside [$minimum, $maximum]."
        }
        if ($source.initial.name -notlike "*$($definition.unitText)*") {
            throw "Could not verify the $($definition.unit) unit from the XML name for $parameterName."
        }

        $parameters[$parameterName] = [ordered]@{
            initial = $initial
            minimum = $minimum
            maximum = $maximum
            unit = $definition.unit
            unitEvidence = [ordered]@{
                xmlPath = $source.initial.nameXmlPath
                value = $source.initial.name
                explicitEngineeringUnit = $source.initial.engineeringUnit
            }
            source = $source
        }
    }
}
finally {
    $zip.Dispose()
}

$result = [ordered]@{
    schemaVersion = '1.0'
    model = $profile.Model
    analysisStatus = 'validated'
    source = [ordered]@{
        archive = $ArchivePath
        selectedEntry = $profile.Entry.FullName
        identification = $metadata
        excludedEntries = $excludedEntries
    }
    pointCountDefinitions = [ordered]@{
        xmlNamespaceUri = $profileNamespace
        memberPath = '/p:profile/p:commIf/p:commIfInfo/p:commIfInfoMember[@label="..."]/p:data/p:item'
        parameterMapping = [ordered]@{
            RX = 'S_B'
            RY = 'R_B'
            RWr = 'S_W'
            RWw = 'R_W'
        }
        commentTextUsedAsEvidence = $false
    }
    parameters = $parameters
    validation = [ordered]@{
        initialWithinMinimumAndMaximum = $true
        allFourParametersPresent = ($parameters.Count -eq 4)
    }
}

$json = $result | ConvertTo-Json -Depth 20
$outputDirectory = [System.IO.Path]::GetDirectoryName($outputFullPath)
if (-not [System.IO.Directory]::Exists($outputDirectory)) {
    [System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
}
$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($outputFullPath, $json + [Environment]::NewLine, $utf8WithoutBom)

Write-Output "Wrote $outputFullPath"
Write-Output "Model: $($profile.Model)"
foreach ($parameterName in $parameters.Keys) {
    $parameter = $parameters[$parameterName]
    Write-Output ("{0}: initial={1}, minimum={2}, maximum={3} {4}" -f $parameterName, $parameter.initial, $parameter.minimum, $parameter.maximum, $parameter.unit)
}
