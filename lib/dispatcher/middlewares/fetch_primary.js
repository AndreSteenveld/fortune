import * as errors from '../../common/errors';

/*!
 * Fetch the primary records. This mutates `context.response`
 * for the next method.
 *
 * @return {Promise}
 */
export default function (context) {
  let type = context.request.type;

  if (!type) return context;

  let ids = context.request.ids;
  let options = Object.assign(context.request.options,
    context.request.optionsPerType.hasOwnProperty(type) ?
    context.request.optionsPerType[type] : {});

  return this.adapter.find(type, ids, options).then(records => {
    // If we got nothing, there's a problem.
    if (!records.length)
      throw new errors.NotFoundError(`No primary records match the request.`);

    context.response.payload.records = records;
    return context;
  });
}
