import type { GmPanelCharacterSheetEntry } from '@dhgc/shared'

export interface GmSheetResourceSnapshot {
  hope: number
  proficiency: boolean[]
  hp: boolean[]
  stress: boolean[]
  armor_slots: boolean[]
  gold: boolean[]
}

const BRIDGE_STYLES = `
  <style id="dhol-gm-bridge-style">
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #f8f5ef !important;
      overflow-x: hidden !important;
    }

    .print\\:hidden,
    .no-print,
    .print-control-buttons,
    .fixed.top-0.left-0.right-0.z-\\[70\\] {
      display: none !important;
    }

    .w-full.max-w-\\[210mm\\],
    .a4-page {
      width: 100% !important;
      max-width: none !important;
    }

    .a4-page {
      margin: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
    }

    button,
    input,
    textarea,
    select,
    label,
    [contenteditable="true"] {
      pointer-events: none !important;
      user-select: none !important;
    }

    [data-gm-allow-click="true"],
    [data-dhol-resource] {
      pointer-events: auto !important;
      user-select: none !important;
    }
  </style>
`

export function getGmSheetResourceSnapshot(entry: GmPanelCharacterSheetEntry): GmSheetResourceSnapshot {
  return {
    hope: entry.parsed_sheet.resources.hope,
    proficiency: [...entry.parsed_sheet.resources.proficiency],
    hp: [...entry.parsed_sheet.resources.hp],
    stress: [...entry.parsed_sheet.resources.stress],
    armor_slots: [...entry.parsed_sheet.resources.armor_slots],
    gold: [...entry.parsed_sheet.resources.gold],
  }
}

export function buildGmSheetSrcDoc(sheetId: string, html: string, initialResources?: GmSheetResourceSnapshot, parentOrigin = window.location.origin): string {
  const bridgeScript = createBridgeScript(sheetId, initialResources, parentOrigin)
  const withStyles = injectIntoDocument(html, '</head>', BRIDGE_STYLES)
  return injectIntoDocument(withStyles, '</body>', bridgeScript)
}

function injectIntoDocument(source: string, closingTag: string, injection: string) {
  const lowerSource = source.toLowerCase()
  const lowerClosingTag = closingTag.toLowerCase()
  const index = lowerSource.lastIndexOf(lowerClosingTag)

  if (index < 0) {
    return `${source}${injection}`
  }

  return `${source.slice(0, index)}${injection}${source.slice(index)}`
}

function createBridgeScript(sheetId: string, initialResources?: GmSheetResourceSnapshot, parentOrigin = '*') {
  const normalizedInitialResources: GmSheetResourceSnapshot = {
    hope: initialResources?.hope ?? 0,
    proficiency: [...(initialResources?.proficiency ?? [])],
    hp: [...(initialResources?.hp ?? [])],
    stress: [...(initialResources?.stress ?? [])],
    armor_slots: [...(initialResources?.armor_slots ?? [])],
    gold: [...(initialResources?.gold ?? [])],
  }

  return `
    <script>
      (function () {
        var SHEET_ID = ${JSON.stringify(sheetId)};
        var PARENT_ORIGIN = ${JSON.stringify(parentOrigin)};
        var INITIAL_RESOURCES = ${JSON.stringify(normalizedInitialResources)};
        var RESOURCE_KEYS = ['hope', 'proficiency', 'hp', 'stress', 'armor_slots', 'gold'];
        var resourceMap = createEmptyResourceMap();
        var initialized = false;
        var suppressReporting = false;

        function createEmptyResourceMap() {
          return {
            hope: [],
            proficiency: [],
            hp: [],
            stress: [],
            armor_slots: [],
            gold: [],
          };
        }

        function isKnownResourceKey(value) {
          return RESOURCE_KEYS.indexOf(value) >= 0;
        }

        function indexResourceElements() {
          resourceMap = createEmptyResourceMap();

          Array.prototype.slice.call(document.querySelectorAll('[data-dhol-resource][data-dhol-index]')).forEach(function (element) {
            var resourceKey = element.getAttribute('data-dhol-resource');
            var index = Number(element.getAttribute('data-dhol-index'));

            if (!isKnownResourceKey(resourceKey) || !Number.isInteger(index) || index < 0) {
              return;
            }

            element.setAttribute('data-gm-allow-click', 'true');
            resourceMap[resourceKey][index] = element;
          });

          RESOURCE_KEYS.forEach(function (resourceKey) {
            resourceMap[resourceKey] = resourceMap[resourceKey].filter(Boolean);
          });
        }

        function normalizeBooleanTrack(nextValue, length) {
          var normalized = [];
          for (var index = 0; index < length; index += 1) {
            normalized.push(Boolean(Array.isArray(nextValue) && nextValue[index]));
          }
          return normalized;
        }

        function cloneResources(resources) {
          return {
            hope: typeof resources.hope === 'number' ? resources.hope : 0,
            proficiency: Array.isArray(resources.proficiency) ? resources.proficiency.slice() : [],
            hp: Array.isArray(resources.hp) ? resources.hp.slice() : [],
            stress: Array.isArray(resources.stress) ? resources.stress.slice() : [],
            armor_slots: Array.isArray(resources.armor_slots) ? resources.armor_slots.slice() : [],
            gold: Array.isArray(resources.gold) ? resources.gold.slice() : [],
          };
        }

        function hasClassToken(element, token) {
          return Boolean(element && String(element.className || '').split(/\\s+/).indexOf(token) >= 0);
        }

        function hasFilledClass(element) {
          return [
            'bg-gray-800',
            'bg-gray-900',
            'bg-slate-800',
            'bg-slate-900',
            'bg-zinc-800',
            'bg-zinc-900',
            'bg-neutral-800',
            'bg-neutral-900',
            'bg-stone-800',
            'bg-stone-900',
            'bg-black',
          ].some(function (token) {
            return hasClassToken(element, token);
          });
        }

        function isFilled(element) {
          return hasFilledClass(element);
        }

        function hasHopeFill(element) {
          return Boolean(element && (
            hasFilledClass(element) ||
            element.querySelector([
              '[data-gm-hope-fill]',
              '.absolute .bg-gray-800',
              '.absolute .bg-gray-900',
              '.absolute .bg-slate-800',
              '.absolute .bg-slate-900',
              '.absolute .bg-zinc-800',
              '.absolute .bg-zinc-900',
              '.absolute .bg-neutral-800',
              '.absolute .bg-neutral-900',
              '.absolute .bg-stone-800',
              '.absolute .bg-stone-900',
              '.absolute .bg-black',
            ].join(', '))
          ));
        }

        function getTrackLength(resourceKey) {
          if (resourceMap[resourceKey].length > 0) {
            return resourceMap[resourceKey].length;
          }
          if (Array.isArray(INITIAL_RESOURCES[resourceKey])) {
            return INITIAL_RESOURCES[resourceKey].length;
          }
          return 0;
        }

        function readResourceValue(resourceKey) {
          if (resourceKey === 'hope') {
            if (resourceMap.hope.length > 0) {
              return resourceMap.hope.filter(hasHopeFill).length;
            }
            return typeof INITIAL_RESOURCES.hope === 'number' ? INITIAL_RESOURCES.hope : 0;
          }

          var length = getTrackLength(resourceKey);
          return normalizeBooleanTrack(resourceMap[resourceKey].map(isFilled), length);
        }

        function readAllResources() {
          return {
            hope: readResourceValue('hope'),
            proficiency: readResourceValue('proficiency'),
            hp: readResourceValue('hp'),
            stress: readResourceValue('stress'),
            armor_slots: readResourceValue('armor_slots'),
            gold: readResourceValue('gold'),
          };
        }

        function isResourceValueEqual(left, right) {
          if (Array.isArray(left) && Array.isArray(right)) {
            if (left.length !== right.length) return false;
            for (var index = 0; index < left.length; index += 1) {
              if (Boolean(left[index]) !== Boolean(right[index])) return false;
            }
            return true;
          }
          return left === right;
        }

        function findChangedResourceKeys(previousResources, nextResources) {
          return RESOURCE_KEYS.filter(function (resourceKey) {
            return !isResourceValueEqual(previousResources[resourceKey], nextResources[resourceKey]);
          });
        }

        function postResourceChange(resourceKey, value) {
          parent.postMessage({
            type: 'dhol-gm-resource-change',
            sheetId: SHEET_ID,
            resourceKey: resourceKey,
            value: value,
          }, PARENT_ORIGIN);
        }

        function postReplayFailure() {
          parent.postMessage({
            type: 'dhol-gm-resource-replay-failed',
            sheetId: SHEET_ID,
          }, PARENT_ORIGIN);
        }

        function wireResourceClicks() {
          Array.prototype.slice.call(document.querySelectorAll('[data-dhol-resource][data-dhol-index]')).forEach(function (element) {
            if (element.getAttribute('data-gm-wired') === 'true') {
              return;
            }

            element.setAttribute('data-gm-wired', 'true');
            element.addEventListener('click', function () {
              var previousResources = cloneResources(readAllResources());

              window.setTimeout(function () {
                if (suppressReporting) {
                  return;
                }

                indexResourceElements();
                var nextResources = readAllResources();
                findChangedResourceKeys(previousResources, nextResources).forEach(function (resourceKey) {
                  postResourceChange(resourceKey, nextResources[resourceKey]);
                });
              }, 0);
            }, true);
          });
        }

        function replayHope(nextValue) {
          var desired = Math.max(0, Math.min(resourceMap.hope.length, Math.round(Number(nextValue) || 0)));
          var current = readResourceValue('hope');

          if (current === desired || resourceMap.hope.length === 0) {
            return;
          }

          if (desired === 0) {
            var clearElement = resourceMap.hope[Math.max(0, current - 1)];
            if (clearElement) clearElement.click();
            return;
          }

          var targetElement = resourceMap.hope[desired - 1];
          if (targetElement) targetElement.click();
        }

        function replayBooleanTrack(resourceKey, nextValue) {
          var elements = resourceMap[resourceKey];
          var desired = normalizeBooleanTrack(nextValue, elements.length);

          elements.forEach(function (element, index) {
            if (isFilled(element) !== desired[index]) {
              element.click();
            }
          });
        }

        function normalizeResourcesForCurrentDom(resources) {
          return {
            hope: Math.max(0, Math.min(resourceMap.hope.length || 12, Math.round(Number(resources && resources.hope) || 0))),
            proficiency: normalizeBooleanTrack(resources && resources.proficiency, getTrackLength('proficiency')),
            hp: normalizeBooleanTrack(resources && resources.hp, getTrackLength('hp')),
            stress: normalizeBooleanTrack(resources && resources.stress, getTrackLength('stress')),
            armor_slots: normalizeBooleanTrack(resources && resources.armor_slots, getTrackLength('armor_slots')),
            gold: normalizeBooleanTrack(resources && resources.gold, getTrackLength('gold')),
          };
        }

        function applyResources(resources) {
          if (!resources || typeof resources !== 'object') {
            return;
          }

          indexResourceElements();
          var desired = normalizeResourcesForCurrentDom(resources);
          suppressReporting = true;

          replayHope(desired.hope);
          ['proficiency', 'hp', 'stress', 'armor_slots', 'gold'].forEach(function (resourceKey) {
            replayBooleanTrack(resourceKey, desired[resourceKey]);
          });

          window.setTimeout(function () {
            suppressReporting = false;
            indexResourceElements();
            var actual = readAllResources();
            if (findChangedResourceKeys(desired, actual).length > 0) {
              postReplayFailure();
            }
          }, 0);
        }

        function init() {
          if (initialized) return;
          initialized = true;
          indexResourceElements();
          wireResourceClicks();
        }

        window.addEventListener('message', function (event) {
          if (!event.data || event.data.type !== 'dhol-gm-sync-resources' || event.data.sheetId !== SHEET_ID) {
            return;
          }

          if (!initialized) {
            init();
          }

          applyResources(event.data.resources);
        });

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', init, { once: true });
        } else {
          init();
        }
      })();
    </script>
  `
}
