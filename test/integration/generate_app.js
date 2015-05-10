import chalk from 'chalk'
import Fortune from '../../lib'
import * as stderr from '../stderr'
import * as fixtures from '../fixtures'


const inParens = /\(([^\)]+)\)/


export default options => {

  const app = new Fortune(options)

  .defineType('user', {
    name: { type: String },
    birthday: { type: Date },

    // Many to many
    friends: { link: 'user', inverse: 'friends', isArray: true },

    // One to one
    spouse: { link: 'user', inverse: 'spouse' },

    // Many to one
    pets: { link: 'animal', inverse: 'owner', isArray: true }
  })

  .transformOutput((context, record) => {
    record.timestamp = Date.now()
    return Promise.resolve(record)
  })

  .defineType('animal', {
    name: { type: String },
    birthday: { type: Date },

    // One to many
    owner: { link: 'user', inverse: 'pets' }
  })

  .transformOutput((context, record) => {
    record.virtualProperty = 123
    return record
  })

  const { events } = app.dispatcher

  app.dispatcher.on(events.change, data => {
    Object.getOwnPropertySymbols(data)
      .forEach(assignDescription.bind(null, data))

    stderr.info(chalk.bold('Change:'), data)
  })

  return app.start()

  // Delete all previous records.
  .then(() => Promise.all(Object.keys(fixtures).map(type =>
    app.adapter.delete(type)
  )))

  // Create fixtures.
  .then(() => Promise.all(Object.keys(fixtures).map(type =>
    app.adapter.create(type, fixtures[type])
  )))

  .then(() => app)

  .catch(error => {
    app.stop()
    throw error
  })
}


function assignDescription (object, symbol) {
  const description = (symbol.toString().match(inParens) || [])[1]
  if (description) object[description] = object[symbol]
}
