import * as XLSX from 'xlsx';

/**
 * Generates an authentic sample Excel workbook (.xlsx) replicating "Oleško 22.08.2026.xlsx".
 * Used for one-click testing and demonstration.
 */
export function generateSampleOleskoXlsx(): { buffer: ArrayBuffer; fileName: string } {
  const wb = XLSX.utils.book_new();

  // List 1
  const list1Data = [
    [103, 'Alenka v říši divů'],
    [201, 'Báječná ženská'],
    [205, 'Dělání'],
    [206, 'Nonstop'],
    [210, 'Jasná zpráva'],
    [212, 'Sladké mámení'],
    [215, 'Trezor'],
    [218, 'Zrcadlo'],
    [222, 'Hrobař'],
    [225, 'Kladivo'],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(list1Data);
  XLSX.utils.book_append_sheet(wb, ws1, 'List 1');

  // List 2
  const list2Data = [
    [120, 'The Last Waltz'],
    [125, 'Pohoda - Kabát'],
    [127, 'Colorado'],
    [130, 'Svařák'],
    [135, 'Malotraktorem'],
    [140, 'Hvězda na vrbě'],
    [142, 'Šrouby do hlavy'],
    [145, 'Dlouhá noc'],
    [150, 'Severní vítr'],
    [152, 'Holky z naší školky'],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(list2Data);
  XLSX.utils.book_append_sheet(wb, ws2, 'List 2');

  // List 3 (authentic from screenshot)
  const list3Data = [
    [44, 'Baroko'],
    [276, 'Shrek - It Is You ... - ALT Sax'],
    [304, 'Moje milá - Marek Ztracený'],
    [306, "If You Can't Give Me Love"],
    [38, 'Náruživá'],
    [249, 'Vlak co nikde nestaví'],
    [247, 'Jedeme dál'],
    [271, 'Chinaski - Víno'],
    [146, 'Město a rock and roll - TENOR Sax'],
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(list3Data);
  XLSX.utils.book_append_sheet(wb, ws3, 'List 3');

  // Lidovky (authentic from screenshot)
  const lidovkyData = [
    [503, 'Sova'],
    [518, 'Moje česká vlast'],
    [501, 'Jetelíček u vody'],
    ['', ''], // blank separator
    [506, 'Letěla husička'],
    [519, 'Ten večer májový'],
    [514, 'Já jsem ten zajíček'],
    ['', ''], // blank separator
    [504, 'Od Tábora'],
    [523, 'Včera jsem byl u muziky'],
    [502, 'Škoda lásky'],
  ];
  const wsLidovky = XLSX.utils.aoa_to_sheet(lidovkyData);
  XLSX.utils.book_append_sheet(wb, wsLidovky, 'Lidovky');

  // Zbytek (authentic from screenshot)
  const zbytekData = [
    [8, 'Nějak se vytrácíš má lásko'],
    [9, 'Dávno'],
    [48, 'Cesta -Kryštof'],
    [50, 'Čekej tiše - TENOR Sax'],
    [52, 'Modrá – Žlutej pes'],
    [64, 'Dej mi víc'],
    [79, 'Sluneční hrob'],
    [80, 'Sen'],
    [90, 'Modrá - Kirschner'],
    [126, 'Vyznání'],
    [129, 'Jsem prý blázen jen'],
    [147, 'První polibek - TENOR Sax'],
    [237, 'Plakalo baby - TENOR Sax'],
    [251, 'All my loving'],
    [252, 'Na nebi svítí – Dan Bárta'],
    [270, 'Mít rád bližního svého - ALT Sax'],
    [280, 'Blues o spolykaných slovech'],
    [294, 'Síla starejch vín - Škwor'],
  ];
  const wsZbytek = XLSX.utils.aoa_to_sheet(zbytekData);
  XLSX.utils.book_append_sheet(wb, wsZbytek, 'Zbytek');

  // Seznam komplet (Index/Catalog - should be skipped by the parser)
  const catalogData = [
    ['ID', 'Název'],
    [8, 'Nějak se vytrácíš'],
    [9, 'Dávno'],
    [38, 'Náruživá'],
    [44, 'Baroko'],
    [48, 'Cesta'],
  ];
  const wsCatalog = XLSX.utils.aoa_to_sheet(catalogData);
  XLSX.utils.book_append_sheet(wb, wsCatalog, 'Seznam komplet');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return { buffer: buf, fileName: 'Oleško 22.08.2026.xlsx' };
}

/**
 * Generates an authentic sample MobileSheets XML (.mss) setlist.
 */
export function generateSampleMssXml(): { xml: string; fileName: string } {
  const xml = `<?xml version='1.0' encoding='UTF-8' standalone='no' ?>
<Setlists>
  <Setlist>
    <Name>01 Oleško 22.08.2026 - Set 1</Name>
    <Song>
      <Title>103 Alenka v říši divů</Title>
      <SongId>103</SongId>
      <FileName>103 Alenka v říši divů.pdf</FileName>
      <FileType>1</FileType>
    </Song>
    <Song>
      <Title>201 Báječná ženská</Title>
      <SongId>201</SongId>
      <FileName>201 Báječná ženská.pdf</FileName>
      <FileType>1</FileType>
    </Song>
    <Song>
      <Title>205 Dělání</Title>
      <SongId>205</SongId>
      <FileName>205 Dělání.pdf</FileName>
      <FileType>1</FileType>
    </Song>
    <Song>
      <Title>206 Nonstop</Title>
      <SongId>206</SongId>
      <FileName>206 Nonstop.pdf</FileName>
      <FileType>1</FileType>
    </Song>
    <Song>
      <Title>210 Jasná zpráva</Title>
      <SongId>210</SongId>
      <FileName>210 Jasná zpráva.pdf</FileName>
      <FileType>1</FileType>
    </Song>
  </Setlist>
  <Setlist>
    <Name>02 Oleško 22.08.2026 - Set 2</Name>
    <Song>
      <Title>044 Baroko</Title>
      <SongId>44</SongId>
      <FileName>044 Baroko.pdf</FileName>
      <FileType>1</FileType>
    </Song>
    <Song>
      <Title>276 Shrek - It Is You (I Have Loved)_alt</Title>
      <SongId>276</SongId>
      <FileName>276 Shrek - It Is You (I Have Loved)_alt.pdf</FileName>
      <FileType>1</FileType>
    </Song>
    <Song>
      <Title>304 Moje milá - Marek Ztracený text</Title>
      <SongId>304</SongId>
      <FileName>304 Moje milá - Marek Ztracený text.pdf</FileName>
      <FileType>1</FileType>
    </Song>
    <Song>
      <Title>271 Chinaski - Víno</Title>
      <SongId>271</SongId>
      <FileName>271 Chinaski - Víno.pdf</FileName>
      <FileType>1</FileType>
    </Song>
  </Setlist>
  <Setlist>
    <Name>03 Oleško 22.08.2026 - Lidovky</Name>
    <Song>
      <Title>503  Sova - alt sax</Title>
      <SongId>503</SongId>
      <FileName>503  Sova - alt sax.pdf</FileName>
      <FileType>1</FileType>
    </Song>
    <Song>
      <Title>518  Moje česká vlast - alt sax</Title>
      <SongId>518</SongId>
      <FileName>518  Moje česká vlast - alt sax.pdf</FileName>
      <FileType>1</FileType>
    </Song>
    <Song>
      <Title>501  Jetelíček u vody - alt sax</Title>
      <SongId>501</SongId>
      <FileName>501  Jetelíček u vody - alt sax.pdf</FileName>
      <FileType>1</FileType>
    </Song>
    <Song>
      <Title>502  Škodovka - alt sax</Title>
      <SongId>502</SongId>
      <FileName>502  Škodovka - alt sax.pdf</FileName>
      <FileType>1</FileType>
    </Song>
  </Setlist>
  <Setlist>
    <Name>04 Oleško 22.08.2026 - Zbytek</Name>
    <Song>
      <Title>008 Nějak se vytrácíš má lásko</Title>
      <SongId>8</SongId>
      <FileName>008 Nějak se vytrácíš má lásko.pdf</FileName>
      <FileType>1</FileType>
    </Song>
    <Song>
      <Title>048 Cesta - Kryštof</Title>
      <SongId>48</SongId>
      <FileName>048 Cesta - Kryštof.pdf</FileName>
      <FileType>1</FileType>
    </Song>
    <Song>
      <Title>050 Čekej tiše_tenor</Title>
      <SongId>50</SongId>
      <FileName>050 Čekej tiše_tenor.pdf</FileName>
      <FileType>1</FileType>
    </Song>
  </Setlist>
</Setlists>`;

  return { xml, fileName: 'Oleško 22.08.2026.mss' };
}
