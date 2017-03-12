export const hover = {
  ':hover': {
    backgroundColor: 'LightGray'
  }
}

export const transition = (property, duration, ease='') => {
  const value = `${property} ${duration}s ${ease}`.trim()
  return {
    transition: value
  }
}

// TODO figure out the place to put this
export const bigIcon = {
  ...transition('color', .25),
  padding: 10,
  color: 'Gray',
  ':hover': {
    color: 'DimGray'
  },
  ':focus': {
    outline: 'none',
    color: 'DarkSlateGray',
  },
}

/* Position functions */

export const fullScreen = {
  position: 'absolute',
  height: '100%',
  width: '100%',
}

export const fixed = (vert, horiz) => ({
  position: 'fixed',
  [vert]: 0,
  [horiz]: 0,
})

/* Reset styles */

export const resetButton = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
}

export const resetLink = {
  textDecoration: 'none',
}