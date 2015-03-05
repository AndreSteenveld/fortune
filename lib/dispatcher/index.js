import stderr from '../common/stderr';
import events from 'events';
import * as errors from '../common/errors';
import * as middlewares from './middlewares';

const idempotentAction = 'find';
const changeEvent = 'change';

// Default flows.
const flows = {
  create: ['fetchRelated', 'doCreate', 'fetchInclude',
    'processResponse'],
  find: ['showIndex', 'fetchRelated', 'fetchPrimary',
    'fetchInclude', 'processResponse'],

  // TODO
  update: [],
  delete: []
};


/**
 * Delegate I/O tasks to adapter and serializers. The dispatcher inherits
 * from the built-in `EventEmitter` object, and emits one event, the `change`
 * event. The argument it receives is an object with the keys `action`,
 * `type`, and `ids`. This may be useful for implementing real-time
 * updates.
 */
export default class Dispatcher extends events.EventEmitter {

  constructor () {
    Object.assign(this, { middlewares, flows }, ...arguments);
    Object.defineProperties(this, {
      _changeEvent: {
        value: changeEvent
      }
    });
  }

  /**
   * This is the primary method for initiating a workflow. It is decoupled
   * from network protocols. The request object must be formatted as follows:
   *
   * ```js
   * {
   *   // The default allowed values are `create`, `find`, `update`, or
   *   // `delete`, which correspond to the names of adapter methods.
   *   // To implement a custom action, define a new flow under `flows`,
   *   // and define middleware functions under `middlewares`.
   *   action: 'find',
   *
   *   type: undefined, // Name of a type.
   *   ids: [], // An array of IDs.
   *
   *   // A field that is a link on the type. This will rewrite
   *   // the original type and IDs if this is specified.
   *   relatedField: undefined,
   *
   *   // A 2-dimensional array specifying what to include. The first
   *   // dimension is a list, the second dimension is depth. For example:
   *   // [['comments'], ['comments', 'author']]
   *   include: [],
   *
   *   // Exactly the same as the adapter's `find` method options.
   *   // The options apply only to the primary type, and not include.
   *   options: { ... },
   *
   *   // A hash keyed by type, and values containing options objects.
   *   // This takes precedence over `options` above.
   *   optionsPerType: { type: { ... } },
   *
   *   // The name of the serializer to use for the input (request).
   *   serializerInput: undefined,
   *
   *   // The name of the serializer to use for the output (response).
   *   serializerOutput: undefined,
   *
   *   meta: {}, // Meta-info of the request.
   *   payload: {} // Payload of the request.
   * }
   * ```
   *
   * The response object is wrapped in a `Promise`, and is much simpler:
   *
   * ```js
   * {
   *   meta: {}, // Meta-info of the request.
   *   statusCode: 0, // Status code to return.
   *   payload: {} // Payload of the response.
   * }
   * ```
   *
   * If the request fails, the returned value of the promise should be the
   * corresponding `Error` object, augmented with the response object.
   *
   * @param {Object} options
   * @param {*} [args]
   * @return {Promise}
   */
  request (options, ...args) {
    let context = setDefaults(options);

    return new Promise(resolve => resolve(
      dispatchRequest.call(this, context, ...args)))
      .catch(error => {
        stderr.error(error.stack || error);

        try {
          context = this.serializer.showError(context, error);
          context = this.serializer.processResponse(context);
        } catch (error) {
          context.response.payload =
            `${error.name}${error.message ? ': ' + error.message : ''}`;
        }

        // If the error is actually an error, then augment the error with the
        // response object, or just create a new error.
        return Promise.reject(Object.assign(
          error instanceof Error ? error : new Error(error),
          context.response));
      });
  }

}


/*!
 * Internal function to dispatch a request.
 *
 * @param {Object} context
 * @param {*} [args]
 * @return {Promise}
 */
function dispatchRequest (context, ...args) {
  let type, ids, action;
  let middlewares = this.middlewares;
  let flows = this.flows;
  let runFlow = (flow, context) => flows[flow].reduce((chain, middleware) =>
    !chain ? Promise.resolve(middlewares[middleware].call(this, context)) :
      chain.then(context => middlewares[middleware].call(this, context)),
    null);

  // Try to process the request.
  context = this.serializer.processRequest(context, ...args);
  type = context.request.type;
  ids = context.request.ids;
  action = context.request.action;

  // Make sure IDs are an array of unique values.
  context.request.ids = [...new Set(Array.isArray(ids) ? ids : [ids])];

  // Block request if type is invalid.
  if ((action !== idempotentAction || !!type) && !(type in this.schemas))
    throw new errors.NotFoundError(`The requested type "${type}" ` +
      `is not a valid type.`);

  // Block invalid action.
  if (!(action in flows))
    throw new errors.MethodError(`The action type "${action}" ` +
      `is unrecognized.`);

  // Do the action.
  return runFlow(action, context).then(context => {
    // Try to process the response.
    context = this.serializer.processResponse(context, ...args);

    return context.response;
  });
}


/*!
 * Set default options on a context's request. For internal use.
 *
 * @param {Object} options
 * @return {Object}
 */
function setDefaults (options = {}) {
  let context = {
    request: {
      action: 'find',
      type: undefined,
      ids: [],
      relatedField: undefined,
      include: [],
      options: {
        filter: {},
        sort: {},
        fields: {},
        match: {},
        limit: 1000,
        offset: 0
      },
      optionsPerType: {},
      serializerInput: undefined,
      serializerOutput: undefined,
      meta: {},
      payload: {}
    },
    response: {
      meta: {},
      statusCode: 0,
      payload: {}
    }
  };

  Object.assign(context.request, options);

  return context;
}
