import checkLinks from '../../adapter/check_links'
import applyUpdate from '../../adapter/apply_update'
import enforce from '../../schema/enforce'
import clone from '../../common/clone'
import * as keys from '../../common/reserved_keys'
import * as errors from '../../common/errors'
import * as arrayProxy from '../../common/array_proxy'

/*!
 * Do updates. First, it must find the records to update, then run transforms
 * and validation, then apply the update as well as links on related records.
 *
 * @return {Promise}
 */
export default function (context) {
  const { type, ids } = context.request
  const { adapter, serializer } = this
  const updates = serializer.parseUpdate(context)
  // const relatedUpdates = {}
  let transaction

  if (!updates.length)
    throw new errors.BadRequestError(
      `There are no valid updates in the request.`)

  updates.forEach(update => {
    if (!~ids.indexOf(update[keys.primary]))
      throw new errors.BadRequestError(
        `An update is missing for at least one of the requested records.`)
  })

  const schema = this.schemas[type]
  const links = new Set(Object.keys(schema)
    .filter(field => schema[field][keys.link]))

  return this.adapter.find(type, updates.map(update => {
    if (!(keys.primary in update))
      throw new errors.BadRequestError(
        `The required field "${keys.primary}" on the update is missing.`)

    return update[keys.primary]
  }))

  .then(records => Promise.all(records.map(record => {
    const update = arrayProxy.find(updates, update =>
      update[keys.primary] === record[keys.primary])

    if (!update)
      throw new errors.NotFoundError(
        `The record to be updated could not be found.`)

    let clonedRecord = clone(record)

    // Apply updates to record.
    clonedRecord = applyUpdate(clonedRecord, schema, update)

    // Enforce the schema before running transform.
    clonedRecord = enforce(clonedRecord, schema)

    // Ensure referential integrity.
    return checkLinks(clonedRecord, schema, links, adapter)

    // Do input transforms.
    .then(() => 'input' in (this.transforms[type] || {}) ?
      this.transforms[type].input(context, record, update) : null)
  })))

  .then(() => adapter.beginTransaction())

  .then(t => {
    transaction = t
    return transaction.update(type, updates)
  })

  .then(() => {
    // TODO: Related updates.
    return
  })

  .then(() => transaction.endTransaction())

  .then(() => {
    // Summarize changes during the lifecycle of the request.
    this.emit(this.changeEvent, {})

    return context
  })
}
