import test from 'node:test';
import assert from 'node:assert/strict';
import { EFFECTS, MOTION_EFFECTS, preset, presetName, referenceTime } from '../src/settings.js';

test('Bare disables every optional effect', () => {
  assert.ok(Object.values(preset('bare')).every(value => value === false));
});

test('Juiced enables presentation without enabling combat or timing changes', () => {
  const settings = preset('juiced');
  for (const effect of EFFECTS) assert.equal(settings[effect.id], effect.group !== 'combat', effect.id);
});

test('Overdrive enables every effect unless reduced motion is requested', () => {
  assert.ok(Object.values(preset('overdrive')).every(Boolean));
  for (const name of ['bare', 'juiced', 'overdrive']) {
    const settings = preset(name, true);
    for (const id of MOTION_EFFECTS) assert.equal(settings[id], false, `${name}: ${id}`);
    assert.equal(presetName(settings, true), name);
  }
});

test('An individual switch creates a custom mix, without mutating a fresh preset', () => {
  const settings = preset('bare');
  settings.impacts = true;
  assert.equal(presetName(settings), 'custom');
  assert.equal(preset('bare').impacts, false);
});

test('Reference links seek to the described part of the talk', () => {
  assert.equal(referenceTime('18:01'), 'https://www.youtube.com/watch?v=AJdEqssNZ-U&t=1081s');
});
