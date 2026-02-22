const simulations = []

const addSimulation = (simulation) => {
  simulations.unshift(simulation)
  if (simulations.length > 20) {
    simulations.pop()
  }
}

const listSimulations = () => simulations

module.exports = {
  addSimulation,
  listSimulations,
}
