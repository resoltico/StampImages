"use strict";
// Raw projections from fourteen independently generated native fixtures, not
// field-matrix images. Expected coordinates are their intended capture values.
module.exports = [
  {
    "name": "bad-refs.jpg",
    "projection": {
      "DateTimeOriginal": "2024:07:15 18:42:10",
      "EXIFGPSLatitude": "10/1 0/1 0/1",
      "EXIFGPSLatitudeRaw": "10 0 0",
      "EXIFGPSLatitudeRef": "X",
      "EXIFGPSLongitude": "20/1 0/1 0/1",
      "EXIFGPSLongitudeRaw": "20 0 0",
      "EXIFGPSLongitudeRef": "Q",
      "ExifToolVersion": "13.55"
    },
    "expected": null,
    "recorded": true
  },
  {
    "name": "base.jpg",
    "projection": {
      "ExifToolVersion": "13.55"
    },
    "expected": null,
    "recorded": false
  },
  {
    "name": "minutes60.jpg",
    "projection": {
      "DateTimeOriginal": "2024:07:15 18:42:10",
      "EXIFGPSLatitude": "10/1 60/1 0/1",
      "EXIFGPSLatitudeRaw": "10 60 0",
      "EXIFGPSLatitudeRef": "N",
      "EXIFGPSLongitude": "20/1 0/1 0/1",
      "EXIFGPSLongitudeRaw": "20 0 0",
      "EXIFGPSLongitudeRef": "E",
      "ExifToolVersion": "13.55"
    },
    "expected": null,
    "recorded": true
  },
  {
    "name": "missing-refs.jpg",
    "projection": {
      "DateTimeOriginal": "2024:07:15 18:42:10",
      "EXIFGPSLatitude": "33/1 51/1 612/25",
      "EXIFGPSLatitudeRaw": "33 51 24.48",
      "EXIFGPSLongitude": "151/1 12/1 1377/25",
      "EXIFGPSLongitudeRaw": "151 12 55.08",
      "ExifToolVersion": "13.55"
    },
    "expected": null,
    "recorded": true
  },
  {
    "name": "mixed.jpg",
    "projection": {
      "DateTimeOriginal": "2024:07:15 18:42:10",
      "EXIFGPSLatitude": "22/1 57/1 171/25",
      "EXIFGPSLatitudeRaw": "22 57 6.84",
      "EXIFGPSLatitudeRef": "S",
      "EXIFGPSLongitude": "43/1 12/1 189/5",
      "EXIFGPSLongitudeRaw": "43 12 37.8",
      "EXIFGPSLongitudeRef": "W",
      "ExifToolVersion": "13.55",
      "XMPGPSLatitude": "48,51.504N",
      "XMPGPSLongitude": "2,17.67E"
    },
    "expected": {
      "latitude": -22.9519,
      "longitude": -43.2105
    },
    "recorded": true
  },
  {
    "name": "quoted-\"-slash-\\-newline-\n-café.jpg",
    "projection": {
      "DateTimeOriginal": "bad \"date\" \\ path\nsecond & <line> 東京",
      "ExifToolVersion": "13.55",
      "XMPGPSLatitude": "22,57.114S",
      "XMPGPSLongitude": "43,12.63W"
    },
    "expected": {
      "latitude": -22.9519,
      "longitude": -43.2105
    },
    "recorded": true
  },
  {
    "name": "valid-sw.jpg",
    "projection": {
      "DateTimeOriginal": "2024:07:15 18:42:10",
      "EXIFGPSLatitude": "22/1 57/1 171/25",
      "EXIFGPSLatitudeRaw": "22 57 6.84",
      "EXIFGPSLatitudeRef": "S",
      "EXIFGPSLongitude": "43/1 12/1 189/5",
      "EXIFGPSLongitudeRaw": "43 12 37.8",
      "EXIFGPSLongitudeRef": "W",
      "ExifToolVersion": "13.55"
    },
    "expected": {
      "latitude": -22.9519,
      "longitude": -43.2105
    },
    "recorded": true
  },
  {
    "name": "wrong-exif-type.jpg",
    "projection": {
      "DateTimeOriginal": "2024:07:15 18:42:10",
      "EXIFGPSLatitudeRaw": "bad",
      "EXIFGPSLatitudeRef": "N",
      "EXIFGPSLongitude": "20/1 0/1 0/1",
      "EXIFGPSLongitudeRaw": "20 0 0",
      "EXIFGPSLongitudeRef": "E",
      "ExifToolVersion": "13.55"
    },
    "expected": null,
    "recorded": true
  },
  {
    "name": "xmp-bad-ref.jpg",
    "projection": {
      "ExifToolVersion": "13.55",
      "XMPGPSLatitude": "22,57.114X",
      "XMPGPSLongitude": "43,12.63Q"
    },
    "expected": null,
    "recorded": true
  },
  {
    "name": "xmp-minutes60.jpg",
    "projection": {
      "ExifToolVersion": "13.55",
      "XMPGPSLatitude": "10,60N",
      "XMPGPSLongitude": "20,0E"
    },
    "expected": null,
    "recorded": true
  },
  {
    "name": "xmp-no-ref.jpg",
    "projection": {
      "ExifToolVersion": "13.55",
      "XMPGPSLatitude": "22,57.114",
      "XMPGPSLongitude": "43,12.63"
    },
    "expected": null,
    "recorded": true
  },
  {
    "name": "xmp-numeric-no-ref.jpg",
    "projection": {
      "DateTimeOriginal": "123",
      "ExifToolVersion": "13.55",
      "XMPGPSLatitude": "22.9519",
      "XMPGPSLongitude": "43.2105"
    },
    "expected": null,
    "recorded": true
  },
  {
    "name": "xmp-only-sw.jpg",
    "projection": {
      "DateTimeOriginal": "2024:07:15 18:42:10",
      "ExifToolVersion": "13.55",
      "XMPGPSLatitude": "22,57.114S",
      "XMPGPSLongitude": "43,12.63W"
    },
    "expected": {
      "latitude": -22.9519,
      "longitude": -43.2105
    },
    "recorded": true
  },
  {
    "name": "zero-denominator.jpg",
    "projection": {
      "DateTimeOriginal": "2024:07:15 18:42:10",
      "EXIFGPSLatitude": "10/0 0/1 0/1",
      "EXIFGPSLatitudeRaw": "inf 0 0",
      "EXIFGPSLatitudeRef": "N",
      "EXIFGPSLongitude": "20/1 0/1 0/1",
      "EXIFGPSLongitudeRaw": "20 0 0",
      "EXIFGPSLongitudeRef": "E",
      "ExifToolVersion": "13.55"
    },
    "expected": null,
    "recorded": true
  }
];
