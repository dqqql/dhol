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

    [data-gm-allow-click="true"] {
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

export function buildGmSheetSrcDoc(sheetId: string, html: string, initialResources?: GmSheetResourceSnapshot): string {
  const bridgeScript = createBridgeScript(sheetId, initialResources)
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

function createBridgeScript(sheetId: string, initialResources?: GmSheetResourceSnapshot) {
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
        var INITIAL_RESOURCES = ${JSON.stringify(normalizedInitialResources)};
        var resourceMap = {
          hope: [],
          proficiency: [],
          hp: [],
          stress: [],
          armor_slots: [],
          gold: [],
        };
        var resourceState = {
          hope: typeof INITIAL_RESOURCES.hope === 'number' ? INITIAL_RESOURCES.hope : 0,
          proficiency: Array.isArray(INITIAL_RESOURCES.proficiency) ? INITIAL_RESOURCES.proficiency.slice() : [],
          hp: Array.isArray(INITIAL_RESOURCES.hp) ? INITIAL_RESOURCES.hp.slice() : [],
          stress: Array.isArray(INITIAL_RESOURCES.stress) ? INITIAL_RESOURCES.stress.slice() : [],
          armor_slots: Array.isArray(INITIAL_RESOURCES.armor_slots) ? INITIAL_RESOURCES.armor_slots.slice() : [],
          gold: Array.isArray(INITIAL_RESOURCES.gold) ? INITIAL_RESOURCES.gold.slice() : [],
        };
        var initialized = false;
        var refreshBindingsTimer = null;
        var mutationObserver = null;

        function normalizeText(value) {
          return (value || '').replace(/\\s+/g, '').trim();
        }

        function ancestorText(element) {
          var parts = [];
          var current = element;

          for (var depth = 0; current && depth < 8; depth += 1) {
            parts.push(normalizeText(current.textContent));
            current = current.parentElement;
          }

          return parts.join(' ');
        }

        function getWindowCharacterData() {
          if (!window.characterData || typeof window.characterData !== 'object') {
            window.characterData = {};
          }

          return window.characterData;
        }

        function getWindowTrackValue(resourceKey) {
          var data = getWindowCharacterData();

          if (resourceKey === 'armor_slots') {
            if (Array.isArray(data.armorBoxes)) {
              return data.armorBoxes;
            }
            if (Array.isArray(data.armor_slots)) {
              return data.armor_slots;
            }
            return [];
          }

          if (resourceKey === 'hope') {
            return typeof data.hope === 'number' ? data.hope : 0;
          }

          return Array.isArray(data[resourceKey]) ? data[resourceKey] : [];
        }

        function setWindowTrackValue(resourceKey, nextValue) {
          var data = getWindowCharacterData();

          if (resourceKey === 'armor_slots') {
            data.armorBoxes = Array.isArray(nextValue) ? nextValue.slice() : [];
            data.armor_slots = Array.isArray(nextValue) ? nextValue.slice() : [];
            return;
          }

          if (resourceKey === 'hope') {
            data.hope = typeof nextValue === 'number' ? nextValue : 0;
            return;
          }

          data[resourceKey] = Array.isArray(nextValue) ? nextValue.slice() : [];
        }

        function isFilled(element) {
          return (element.className || '').indexOf('bg-gray-800') >= 0;
        }

        function looksLikeTrackerCheckbox(element) {
          if (!element || !element.matches) {
            return false;
          }

          if (!element.matches('div, button')) {
            return false;
          }

          var className = element.className || '';
          if (className.indexOf('cursor-pointer') < 0) {
            return false;
          }

          if (className.indexOf('border-gray-800') < 0) {
            return false;
          }

          if (
            className.indexOf('w-3 h-3') < 0 &&
            className.indexOf('w-4 h-4') < 0 &&
            className.indexOf('w-8 h-8') < 0
          ) {
            return false;
          }

          return true;
        }

        function getCheckboxElements(root) {
          return Array.prototype.slice.call(root.querySelectorAll('div, button')).filter(function (element) {
            return isCheckboxElement(element);
          });
        }

        function isCheckboxElement(element) {
          if (!element || !element.matches) {
            return false;
          }

          return element.matches('div[onclick*="toggleCustomCheckbox"], button[onclick*="toggleCustomCheckbox"]')
            || looksLikeTrackerCheckbox(element);
        }

        function hasClickableCheckboxes(root) {
          return getCheckboxElements(root).length > 0;
        }

        function addResourceElements(key, elements) {
          elements.forEach(function (element) {
            if (resourceMap[key].indexOf(element) >= 0) {
              return;
            }

            element.setAttribute('data-gm-resource', key);
            element.setAttribute('data-gm-allow-click', 'true');
            resourceMap[key].push(element);
          });
        }

        function findTextMatches(matcher) {
          return Array.prototype.slice.call(
            document.querySelectorAll('span, div, p, label, strong, b, h1, h2, h3, h4, h5, h6')
          ).filter(function (element) {
            return matcher(normalizeText(element.textContent), element);
          });
        }

        function getDirectSiblingCheckboxes(element) {
          var matches = [];
          var sibling = element.nextElementSibling;

          while (sibling) {
            if (isCheckboxElement(sibling)) {
              matches.push(sibling);
              sibling = sibling.nextElementSibling;
              continue;
            }

            if (matches.length > 0) {
              break;
            }

            sibling = sibling.nextElementSibling;
          }

          return matches;
        }

        function filterCheckboxesByClass(elements, className) {
          if (!className) {
            return elements.slice();
          }

          return elements.filter(function (element) {
            return (element.className || '').indexOf(className) >= 0;
          });
        }

        function getNextSiblingCheckboxGroup(element) {
          var current = element;

          while (current && current !== document.body) {
            var direct = getDirectSiblingCheckboxes(current);
            if (direct.length > 0) {
              return direct;
            }

            var sibling = current.nextElementSibling;
            if (sibling && hasClickableCheckboxes(sibling)) {
              return getCheckboxElements(sibling);
            }

            current = current.parentElement;
          }

          return [];
        }

        function getExpectedTrackLength(key) {
          if (key === 'armor_slots') {
            var armorTrack = getWindowTrackValue('armor_slots');
            if (Array.isArray(armorTrack) && armorTrack.length > 0) {
              return armorTrack.length;
            }

            if (window.characterData && typeof window.characterData === 'object') {
              var armorMax = Number(window.characterData.armorMax);
              if (Number.isFinite(armorMax) && armorMax > 0) {
                return Math.max(0, Math.min(12, Math.round(armorMax)));
              }
            }

            return Array.isArray(resourceState.armor_slots) ? resourceState.armor_slots.length : 0;
          }

          if (key !== 'hope' && Array.isArray(resourceState[key]) && resourceState[key].length > 0) {
            return resourceState[key].length;
          }

          if (key === 'proficiency') {
            return 6;
          }

          if (key === 'gold') {
            return 21;
          }

          var windowTrack = getWindowTrackValue(key);
          return Array.isArray(windowTrack) ? windowTrack.length : 0;
        }

        function trimResourceElements(key, elements) {
          var expectedLength = getExpectedTrackLength(key);
          if (expectedLength <= 0 || elements.length <= expectedLength) {
            return elements;
          }

          if (key === 'stress') {
            return elements.slice(elements.length - expectedLength);
          }

          return elements.slice(0, expectedLength);
        }

        function collectMatchedResourceElements(key, matcher, mode) {
          var labels = findTextMatches(matcher);

          for (var index = 0; index < labels.length; index += 1) {
            var elements = mode === 'direct'
              ? getDirectSiblingCheckboxes(labels[index])
              : getNextSiblingCheckboxGroup(labels[index]);

            if (elements.length === 0 && mode === 'direct') {
              elements = getNextSiblingCheckboxGroup(labels[index]);
            }

            elements = trimResourceElements(key, elements);
            if (elements.length === 0) {
              continue;
            }

            addResourceElements(key, elements);
            return;
          }
        }

        function collectProficiencyElements() {
          var labels = findTextMatches(function (text) {
            return text === '\\u719f\\u7ec3\\u503c';
          });

          for (var index = 0; index < labels.length; index += 1) {
            var elements = filterCheckboxesByClass(getDirectSiblingCheckboxes(labels[index]), 'w-3 h-3');
            elements = trimResourceElements('proficiency', elements);
            if (elements.length === 0) {
              continue;
            }

            addResourceElements('proficiency', elements);
            return;
          }
        }

        function collectGoldElements() {
          var labels = findTextMatches(function (text) {
            return text === '\\u91d1\\u5e01';
          });

          for (var index = 0; index < labels.length; index += 1) {
            var section = labels[index].nextElementSibling;
            if (!section) {
              continue;
            }

            var ordered = [];
            ['\\u628a', '\\u888b', '\\u7bb1'].forEach(function (name) {
              var sublabels = Array.prototype.slice.call(section.querySelectorAll('span, div, p, label, strong, b, h4, h5, h6')).filter(function (element) {
                return normalizeText(element.textContent) === name;
              });

              for (var subIndex = 0; subIndex < sublabels.length; subIndex += 1) {
                var container = sublabels[subIndex].parentElement;
                if (!container || !hasClickableCheckboxes(container)) {
                  continue;
                }

                ordered = ordered.concat(getCheckboxElements(container));
                break;
              }
            });

            ordered = trimResourceElements('gold', ordered);
            if (ordered.length === 0) {
              continue;
            }

            addResourceElements('gold', ordered);
            return;
          }
        }

        function collectArmorSlotElements() {
          var labels = findTextMatches(function (text) {
            return text === '\\u62a4\\u7532\\u69fd';
          });

          for (var index = 0; index < labels.length; index += 1) {
            var elements = getNextSiblingCheckboxGroup(labels[index]);
            if (elements.length === 0) {
              continue;
            }

            addResourceElements('armor_slots', elements);
            return true;
          }

          return false;
        }

        function supplementResourceElements(key, elements) {
          var expectedLength = getExpectedTrackLength(key);
          var remaining = expectedLength - resourceMap[key].length;
          if (remaining <= 0) {
            return;
          }

          addResourceElements(key, elements.slice(0, remaining));
        }

        function collectFallbackResourceElements() {
          var unassigned = getCheckboxElements(document.body).filter(function (element) {
            return !element.getAttribute('data-gm-resource');
          });

          supplementResourceElements('proficiency', unassigned.filter(function (element) {
            return (element.className || '').indexOf('w-3 h-3') >= 0;
          }));

          supplementResourceElements('gold', unassigned.filter(function (element) {
            return (element.className || '').indexOf('w-8 h-8') >= 0;
          }));

          var medium = unassigned.filter(function (element) {
            return (element.className || '').indexOf('w-4 h-4') >= 0;
          });
          var offset = 0;

          ['hp', 'stress', 'armor_slots'].forEach(function (key) {
            var expectedLength = getExpectedTrackLength(key);
            var remaining = expectedLength - resourceMap[key].length;
            if (remaining <= 0) {
              return;
            }

            addResourceElements(key, medium.slice(offset, offset + remaining));
            offset += remaining;
          });
        }

        function classifyElement(element) {
          if (element.hasAttribute('data-hope-index')) {
            return 'hope';
          }

          var className = element.className || '';
          var current = element;

          for (var depth = 0; current && depth < 8; depth += 1) {
            var text = normalizeText(current.textContent);

            if (text.indexOf('熟练值') >= 0 && className.indexOf('w-3 h-3') >= 0) {
              return 'proficiency';
            }

            if ((text.indexOf('护甲槽') >= 0 || text.indexOf('护甲') >= 0) && text.indexOf('生命点') < 0 && text.indexOf('压力点') < 0 && className.indexOf('w-4 h-4') >= 0) {
              return 'armor_slots';
            }

            if (text.indexOf('压力点') >= 0 && text.indexOf('生命点') < 0 && className.indexOf('w-4 h-4') >= 0) {
              return 'stress';
            }

            if (text.indexOf('生命点') >= 0 && className.indexOf('w-4 h-4') >= 0) {
              return 'hp';
            }

            if (text.indexOf('金币') >= 0) {
              return 'gold';
            }

            current = current.parentElement;
          }

          return null;
        }

        function collectClassifiedResourceElements() {
          var buckets = {
            hope: [],
            proficiency: [],
            hp: [],
            stress: [],
            armor_slots: [],
            gold: [],
          };

          getCheckboxElements(document.body).forEach(function (element) {
            if (element.getAttribute('data-gm-resource')) {
              return;
            }

            var key = classifyElement(element);
            if (!key) {
              return;
            }

            buckets[key].push(element);
          });

          Object.keys(buckets).forEach(function (key) {
            if (key === 'armor_slots' && resourceMap.armor_slots.length > 0) {
              return;
            }

            var elements = trimResourceElements(key, buckets[key]);
            if (elements.length === 0) {
              return;
            }

            addResourceElements(key, elements);
          });

          collectFallbackResourceElements();
        }

        function collectResourceElements() {
          resourceMap = {
            hope: [],
            proficiency: [],
            hp: [],
            stress: [],
            armor_slots: [],
            gold: [],
          };

          addResourceElements(
            'hope',
            Array.prototype.slice.call(document.querySelectorAll('[data-hope-index]'))
          );
          collectProficiencyElements();
          collectMatchedResourceElements('hp', function (text) {
            return text === '\\u751f\\u547d\\u70b9' || (text.indexOf('\\u751f\\u547d\\u70b9') === 0 && text.indexOf('\\u538b\\u529b\\u70b9') < 0);
          }, 'group');
          collectMatchedResourceElements('stress', function (text) {
            return text === '\\u538b\\u529b\\u70b9';
          }, 'group');
          if (!collectArmorSlotElements()) {
            collectMatchedResourceElements('armor_slots', function (text) {
              return text === '\\u62a4\\u7532' || text === '\\u62a4\\u7532\\u69fd' || text.indexOf('\\u62a4\\u7532\\u69fd') === 0;
            }, 'group');
          }
          collectGoldElements();
          collectClassifiedResourceElements();
        }

        function normalizeHopeFill(element) {
          var fill = element.querySelector('[data-gm-hope-fill]');
          if (fill) {
            return fill;
          }

          var existing = element.querySelector('.pointer-events-none > div');
          if (existing) {
            existing.setAttribute('data-gm-hope-fill', 'true');
            return existing;
          }

          return null;
        }

        function normalizeBooleanTrack(nextValue, length) {
          var normalized = [];

          for (var index = 0; index < length; index += 1) {
            normalized.push(Boolean(Array.isArray(nextValue) && nextValue[index]));
          }

          return normalized;
        }

        function isResourceValueEqual(left, right) {
          if (Array.isArray(left) && Array.isArray(right)) {
            if (left.length !== right.length) {
              return false;
            }

            for (var index = 0; index < left.length; index += 1) {
              if (Boolean(left[index]) !== Boolean(right[index])) {
                return false;
              }
            }

            return true;
          }

          return left === right;
        }

        function findChangedResourceKeys(previousResources, nextResources) {
          return ['hope', 'proficiency', 'hp', 'stress', 'armor_slots', 'gold'].filter(function (key) {
            return !isResourceValueEqual(previousResources[key], nextResources[key]);
          });
        }

        function getResourceElementPosition(element) {
          var resourceKeys = ['hope', 'proficiency', 'hp', 'stress', 'armor_slots', 'gold'];

          for (var resourceKeyIndex = 0; resourceKeyIndex < resourceKeys.length; resourceKeyIndex += 1) {
            var resourceKey = resourceKeys[resourceKeyIndex];
            var index = resourceMap[resourceKey].indexOf(element);
            if (index >= 0) {
              return {
                resourceKey: resourceKey,
                index: index,
              };
            }
          }

          return null;
        }

        function applyFallbackToggle(position, previousResources) {
          if (!position) {
            return null;
          }

          var nextResources = cloneResourceState(previousResources);
          if (position.resourceKey === 'hope') {
            nextResources.hope = previousResources.hope === position.index + 1 ? 0 : position.index + 1;
          } else {
            var currentTrack = Array.isArray(nextResources[position.resourceKey]) ? nextResources[position.resourceKey].slice() : [];
            currentTrack[position.index] = !currentTrack[position.index];
            nextResources[position.resourceKey] = currentTrack;
          }

          return nextResources;
        }

        function ensureInteractiveElements() {
          Array.prototype.slice.call(document.querySelectorAll('[data-hope-index]')).forEach(function (element) {
            element.setAttribute('data-gm-allow-click', 'true');
          });

          getCheckboxElements(document.body).forEach(function (element) {
            element.setAttribute('data-gm-allow-click', 'true');
          });
        }

        function rebindResourceElements() {
          collectResourceElements();
          ensureInteractiveElements();
          wireResourceClicks();
        }

        function refreshResourceBindings() {
          rebindResourceElements();
          applyResources(resourceState);
        }

        function scheduleRefreshBindings() {
          if (refreshBindingsTimer) {
            return;
          }

          refreshBindingsTimer = window.setTimeout(function () {
            refreshBindingsTimer = null;
            refreshResourceBindings();
          }, 0);
        }

        function startMutationObserver() {
          if (mutationObserver || !window.MutationObserver || !document.body) {
            return;
          }

          mutationObserver = new MutationObserver(function (mutations) {
            for (var index = 0; index < mutations.length; index += 1) {
              if (mutations[index].type === 'childList') {
                scheduleRefreshBindings();
                return;
              }
            }
          });

          mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
          });
        }

        function setBooleanFilled(element, shouldFill) {
          if (!element) {
            return;
          }

          var className = element.className || '';
          var nextClassName = className;

          if (className.indexOf('bg-gray-800') >= 0) {
            nextClassName = shouldFill
              ? className
              : className.replace(/\\bbg-gray-800\\b/g, 'bg-white');
          } else if (className.indexOf('bg-white') >= 0) {
            nextClassName = shouldFill
              ? className.replace(/\\bbg-white\\b/g, 'bg-gray-800')
              : className;
          } else if (shouldFill) {
            nextClassName = className + ' bg-gray-800';
          } else {
            nextClassName = className + ' bg-white';
          }

          nextClassName = nextClassName.replace(/\\s+/g, ' ').trim();
          if (nextClassName !== className) {
            element.className = nextClassName;
          }

          element.setAttribute('aria-checked', shouldFill ? 'true' : 'false');
          element.setAttribute('aria-pressed', shouldFill ? 'true' : 'false');
          element.setAttribute('data-gm-filled', shouldFill ? 'true' : 'false');
        }

        function cloneResourceState(resources) {
          return {
            hope: typeof resources.hope === 'number' ? resources.hope : 0,
            proficiency: Array.isArray(resources.proficiency) ? resources.proficiency.slice() : [],
            hp: Array.isArray(resources.hp) ? resources.hp.slice() : [],
            stress: Array.isArray(resources.stress) ? resources.stress.slice() : [],
            armor_slots: Array.isArray(resources.armor_slots) ? resources.armor_slots.slice() : [],
            gold: Array.isArray(resources.gold) ? resources.gold.slice() : [],
          };
        }

        function applyHope(value) {
          var nextValue = typeof value === 'number' ? value : 0;
          setWindowTrackValue('hope', nextValue);

          resourceMap.hope.forEach(function (element, index) {
            var shouldFill = index < nextValue;
            var fill = normalizeHopeFill(element);

            if (shouldFill && !fill) {
              var overlay = document.createElement('div');
              overlay.className = 'absolute inset-0 flex items-center justify-center pointer-events-none';
              var diamond = document.createElement('div');
              diamond.className = 'w-3 h-3 bg-gray-800 transform rotate-45';
              diamond.setAttribute('data-gm-hope-fill', 'true');
              overlay.appendChild(diamond);
              element.appendChild(overlay);
              return;
            }

            if (!shouldFill && fill) {
              var parent = fill.parentElement;
              if (parent && parent !== element) {
                parent.remove();
              } else {
                fill.remove();
              }
            }
          });
        }

        function syncBooleanElements(elements, nextValue) {
          var target = Array.isArray(nextValue) ? nextValue : [];

          for (var index = 0; index < elements.length; index += 1) {
            var element = elements[index];
            var desired = Boolean(target[index]);
            if (isFilled(element) === desired) {
              continue;
            }

            setBooleanFilled(element, desired);
          }
        }

        function readResourceValue(resourceKey) {
          if (resourceKey === 'hope') {
            if (resourceMap.hope.length > 0) {
              return resourceMap.hope.filter(function (element) { return normalizeHopeFill(element); }).length;
            }

            return getWindowTrackValue('hope');
          }

          var expectedLength = getExpectedTrackLength(resourceKey);
          if (resourceMap[resourceKey].length > 0) {
            return normalizeBooleanTrack(resourceMap[resourceKey].map(function (element) {
              return isFilled(element);
            }), expectedLength || resourceMap[resourceKey].length);
          }

          var windowTrack = getWindowTrackValue(resourceKey);
          return normalizeBooleanTrack(windowTrack, expectedLength || windowTrack.length);
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

        function postResourceChange(resourceKey, value, index) {
          parent.postMessage({
            type: 'dhol-gm-resource-change',
            sheetId: SHEET_ID,
            resourceKey: resourceKey,
            value: value,
            index: typeof index === 'number' ? index : null,
          }, '*');
        }

        function wireResourceClicks() {
          var interactiveElements = Array.prototype.slice.call(document.querySelectorAll('[data-hope-index]'))
            .concat(getCheckboxElements(document.body));

          interactiveElements.forEach(function (element) {
            if (element.getAttribute('data-gm-wired') === 'true') {
              return;
            }

            element.setAttribute('data-gm-wired', 'true');
            element.addEventListener('click', function () {
              var previousResources = cloneResourceState(readAllResources());
              var position = getResourceElementPosition(element);

              window.setTimeout(function () {
                rebindResourceElements();
                var nextResources = readAllResources();
                var changedKeys = findChangedResourceKeys(previousResources, nextResources);

                if (changedKeys.length === 0) {
                  var fallbackResources = applyFallbackToggle(position, previousResources);
                  if (fallbackResources) {
                    applyResources(fallbackResources);
                    nextResources = cloneResourceState(fallbackResources);
                    changedKeys = findChangedResourceKeys(previousResources, nextResources);
                  }
                }

                resourceState = cloneResourceState(nextResources);

                changedKeys.forEach(function (resourceKey) {
                  postResourceChange(resourceKey, nextResources[resourceKey]);
                });
              }, 0);
            }, true);
          });
        }

        function applyResources(resources) {
          if (!resources || typeof resources !== 'object') {
            return;
          }

          applyHope(resources.hope);
          syncBooleanElements(resourceMap.proficiency, resources.proficiency);
          syncBooleanElements(resourceMap.hp, resources.hp);
          syncBooleanElements(resourceMap.stress, resources.stress);
          syncBooleanElements(resourceMap.armor_slots, resources.armor_slots);
          syncBooleanElements(resourceMap.gold, resources.gold);

          var proficiencyLength = getExpectedTrackLength('proficiency') || resourceMap.proficiency.length || (Array.isArray(resources.proficiency) ? resources.proficiency.length : 0);
          var hpLength = getExpectedTrackLength('hp') || resourceMap.hp.length || (Array.isArray(resources.hp) ? resources.hp.length : 0);
          var stressLength = getExpectedTrackLength('stress') || resourceMap.stress.length || (Array.isArray(resources.stress) ? resources.stress.length : 0);
          var armorLength = getExpectedTrackLength('armor_slots') || resourceMap.armor_slots.length || (Array.isArray(resources.armor_slots) ? resources.armor_slots.length : 0);
          var goldLength = getExpectedTrackLength('gold') || resourceMap.gold.length || (Array.isArray(resources.gold) ? resources.gold.length : 0);

          resourceState = {
            hope: typeof resources.hope === 'number' ? resources.hope : 0,
            proficiency: normalizeBooleanTrack(resources.proficiency, proficiencyLength),
            hp: normalizeBooleanTrack(resources.hp, hpLength),
            stress: normalizeBooleanTrack(resources.stress, stressLength),
            armor_slots: normalizeBooleanTrack(resources.armor_slots, armorLength),
            gold: normalizeBooleanTrack(resources.gold, goldLength),
          };
          setWindowTrackValue('proficiency', resourceState.proficiency);
          setWindowTrackValue('hp', resourceState.hp);
          setWindowTrackValue('stress', resourceState.stress);
          setWindowTrackValue('armor_slots', resourceState.armor_slots);
          setWindowTrackValue('gold', resourceState.gold);
        }

        function init() {
          if (initialized) {
            return;
          }

          initialized = true;
          refreshResourceBindings();
          resourceState = cloneResourceState(readAllResources());
          applyResources(resourceState);
          startMutationObserver();
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
