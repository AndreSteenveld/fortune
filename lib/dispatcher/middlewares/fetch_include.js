import * as keys from '../../common/reserved_keys'


/**
 * Fetch included records. This mutates `context`.response`
 * for the next method.
 *
 * @return {Promise}
 */
export default function (context) {
  const { schemas, adapter } = this
  const { type, ids } = context.request

  if (!type) return context

  const include = context.request.include || []
  const records = context.response.records || []

  // This cache is used to keep unique IDs per type.
  const idCache = {
    [type]: new Set(ids)
  }

  // It's necessary to iterate over primary records if no IDs were
  // provided initially.
  if (ids && !ids.length)
    for (let record of records)
      idCache[type].add(record[keys.primary])

  return Promise.all(include.map(fields => new Promise((resolve, reject) => {
    let currentType = type
    let currentIds = []
    let currentOptions

    // Coerce field into an array.
    if (!Array.isArray(fields))
      fields = [ fields ]

    // `cursor` refers to the current collection of records.
    return fields.reduce((records, field) => records.then(cursor => {
      if (!currentType || !(field in schemas[currentType]))
        return []

      const idCache = new Set()

      currentType = schemas[currentType][field][keys.link]
      currentOptions = 'includeOptions' in context.request ?
        context.request.includeOptions[currentType] : null
      currentIds = cursor.reduce((ids, record) => {
        const linkedIds = Array.isArray(record[field]) ?
          record[field] : [ record[field] ]

        for (let id of linkedIds)
          if (id && !idCache.has(id)) {
            idCache.add(id)
            ids.push(id)
          }

        return ids
      }, [])

      const args = [ currentType, currentIds ]

      if (currentOptions) args.push(currentOptions)

      return currentIds.length ? adapter.find(...args) : []
    }), Promise.resolve(records))
    .then(records => resolve({
      type: currentType,
      ids: currentIds,
      records
    }), error => reject(error))
  })))

  .then(containers => {
    const include = containers.reduce((include, container) => {
      if (!container.ids.length) return include

      // Lengths should be the same.
      if (container.ids.length !== container.records.length)
        throw new Error(`There was an error fetching included records.`)

      include[container.type] = include[container.type] || []

      // Only include unique IDs per type.
      idCache[container.type] = idCache[container.type] || new Set()

      for (let index = 0; index < container.ids.length; index++) {
        const id = container.ids[index]

        if (!idCache[container.type].has(id)) {
          idCache[container.type].add(id)
          include[container.type].push(container.records[index])
        }
      }

      // If nothing so far, delete the type from include.
      if (!include[container.type].length)
        delete include[container.type]

      return include
    }, {})

    if (Object.keys(include).length)
      Object.defineProperty(context.response, 'include', {
        configurable: true,
        value: include
      })

    return context
  })
}
