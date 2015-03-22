import keys from '../../schema/reserved_keys';
import primaryKey from '../../common/primary_key';


/*!
 * Fetch included records. This mutates `context`.response`
 * for the next method.
 *
 * @return {Promise}
 */
export default function (context) {
  let include = context.request.include || [];
  let type = context.request.type;
  let records = context.response.payload.records;

  // This cache is used to keep unique IDs per type.
  let idCache = {
    [type]: new Set(context.request.ids)
  };

  // It's necessary to iterate over primary records if no IDs were
  // provided initially.
  if (!context.request.ids.length)
    records.forEach(record => idCache[type].add(record[primaryKey]));

  return Promise.all(include.map(fields => new Promise(resolve => {
    let currentType = type;
    let currentIds = [];
    let currentOptions = {};

    // Coerce field into an array.
    if (!Array.isArray(fields))
      fields = [fields];

    // `cursor` refers to the current collection of records.
    return fields.reduce((records, field) => records.then(cursor => {
      if (!currentType || !(field in this.schemas[currentType]))
        return [];

      let idCache = new Set();

      currentType = this.schemas[currentType][field][keys.link];
      currentIds = cursor.reduce((ids, record) => {

        (Array.isArray(record[field]) ?
          record[field] : [record[field]]).forEach(id => {
            if (!idCache.has(id)) {
              idCache.add(id);
              ids.push(id);
            }
          });

        return ids;
      }, []);

      if (currentType in context.request.optionsPerType)
        currentOptions = currentType === type ?
          Object.assign(context.request.options,
            context.request.optionsPerType[currentType]) :
          context.request.optionsPerType[currentType];

      return currentIds.length ?
        this.adapter.find(currentType, currentIds, currentOptions) : [];
    }), Promise.resolve(records))
      .then(records => resolve({
        type: currentType,
        ids: currentIds,
        records
      }));
  }))).then(containers => {
    let include = containers.reduce((include, container) => {
      if (!container.ids.length) return include;

      // Lengths should be the same.
      if (container.ids.length !== container.records.length)
        throw new Error(`There was an error fetching included records.`);

      include[container.type] = include[container.type] || [];

      // Only include unique IDs per type.
      idCache[container.type] = idCache[container.type] || new Set();
      container.ids.forEach((id, index) => {
        if (!idCache[container.type].has(id)) {
          idCache[container.type].add(id);
          include[container.type].push(container.records[index]);
        }
      });

      // If nothing so far, delete the type from include.
      if (!include[container.type].length)
        delete include[container.type];

      return include;
    }, {});

    if (Object.keys(include).length)
      context.response.payload.include = include;

    return context;
  });
}
