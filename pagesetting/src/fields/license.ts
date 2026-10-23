import { LICENSES, NOT_SET, type FieldConfig } from '../config';
import { el, labelled } from '../dom';
import type { FieldControl } from '../types';

/**
 * License + version pair. The version list only offers versions the chosen license
 * allows; changing the license keeps the version if still valid, otherwise picks the
 * license's newest one (or none, for licenses without versions).
 */
export function licenseField(field: FieldConfig, current: string[], id: string, onChange: () => void): FieldControl {
  const prefix = field.prefix;
  const versionPrefix = field.versionPrefix || '';
  const [savedLicense = '', savedVersion = ''] = current;
  const versionId = `${id}-version`;

  const license = el('select', 'cps-select');
  license.id = id;
  license.add(new Option('(not set)', NOT_SET));
  LICENSES.forEach((l) => license.add(new Option(l.text, prefix + l.key)));
  // Keep a saved license the list doesn't know, so saving doesn't drop it.
  if (savedLicense && !LICENSES.some((l) => prefix + l.key === savedLicense)) {
    license.add(new Option(savedLicense.slice(prefix.length), savedLicense));
  }
  license.value = savedLicense || NOT_SET;

  const version = el('select', 'cps-select');
  version.id = versionId;

  const versionTags = (licenseTag: string) =>
    (LICENSES.find((l) => prefix + l.key === licenseTag)?.versions || []).map(([key, label]): [string, string] => [versionPrefix + key, label]);

  // keepSaved shows a saved version even when it doesn't fit (only when loading or reverting).
  const fillVersions = (licenseTag: string, wanted: string, keepSaved: boolean) => {
    const options = versionTags(licenseTag);
    version.replaceChildren(new Option(options.length ? '(not set)' : '—', NOT_SET));
    options.forEach(([tag, label]) => version.add(new Option(label, tag)));
    if (keepSaved && wanted && !options.some(([tag]) => tag === wanted)) {
      version.add(new Option(wanted.slice(versionPrefix.length), wanted));
    }
    version.value = Array.from(version.options).some((o) => o.value === wanted) ? wanted : NOT_SET;
    version.disabled = version.options.length <= 1;
  };
  fillVersions(license.value, savedVersion, true);

  license.addEventListener('change', () => {
    const options = versionTags(license.value);
    const stillValid = options.some(([tag]) => tag === version.value);
    const newest = options.length ? options[options.length - 1][0] : '';
    fillVersions(license.value, stillValid ? version.value : newest, false);
    onChange();
  });
  version.addEventListener('change', onChange);

  const read = () => [license.value, version.value].filter((v) => v !== NOT_SET);
  let committed = { license: license.value, version: version.value };

  const node = el('div', 'cps-field-pair');
  node.append(labelled(field.label, license, id), labelled('Version', version, versionId));

  return {
    node,
    tags: read,
    display: () => {
      if (license.value === NOT_SET) return '';
      const text = license.selectedOptions[0]?.textContent?.trim() || '';
      const ver = version.value === NOT_SET ? '' : version.selectedOptions[0]?.textContent?.trim() || '';
      return ver ? `${text} ${ver}` : text;
    },
    committedTags: () => [committed.license, committed.version].filter((v) => v !== NOT_SET),
    commit: () => { committed = { license: license.value, version: version.value }; },
    revert: () => {
      license.value = committed.license;
      fillVersions(committed.license, committed.version, true);
    },
  };
}
