/**
 * Character types based on DATA_MODEL.md
 */

export interface BaseStats {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface Character {
  characterId: string;
  userId: string;
  name: string;
  species: string;
  baseStats?: BaseStats;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterState {
  selectedCharacter: Character | null;
  characters: Character[];
  isLoading: boolean;
  error: string | null;
}
