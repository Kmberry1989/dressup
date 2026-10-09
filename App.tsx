import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Flow } from 'flow-sdk';
import { AppState, CosplayItem, GeneratedLook, PriceLevel, UserImage } from './types';
import { SectionLabel, PillButton, FieldDropdown, TextInput, SegmentedToggle, Checkbox } from './components/Primitives';
const COSPLAY_STORES = [
  'AliExpress',
  'Amazon',
  'Arda Wigs',
  'ASOS',
  'Coscraft',
  'CosplaySky',
  'DokiDoki Cosplay',
  'eBay',
  'Ehire',
  'Epic Cosplay',
  'Etsy',
  'EZCosplay',
  'FM-Anime',
  'Google Shopping',
  'H&M',
  'Kohl\'s',
  'Macy\'s',
  'Mercari',
  'Miccostumes',
  'Nordstrom',
  'Procosplay',
  'RoleCosplay',
  'SimCosplay',
  'SkyCostume',
  'Target',
  'Uwowo',
  'Walmart',
  'WigIsFashion',
  'XCoser',
  'Zara'
];
const STYLE_OPTIONS = [
  'None', 
  'Avant-Garde', 
  'Classic Tuxedo', 
  'Ballroom Gown',
  'High-Fashion Editorial', 
