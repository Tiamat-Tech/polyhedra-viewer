import React from 'react';
import { css, StyleSheet } from 'aphrodite/no-important';
import { Link } from 'react-router-dom';

import { escapeName } from 'polyhedra/names';
import { hover } from 'styles/common';

const thumbnailSize = 55;

const largeSize = 80;

const styles = StyleSheet.create({
  link: {
    width: thumbnailSize,
    height: thumbnailSize,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 10,
    margin: 'auto', // center inside a table
  },

  largeLink: {
    width: largeSize,
    height: largeSize,
  },

  real: hover,

  image: {
    height: thumbnailSize + 10,
  },

  largeImage: {
    height: largeSize + 10,
  },

  fake: {
    opacity: 0.25,
    filter: 'grayscale(50%)',
  },
});

export default function PolyhedronLink({
  name,
  isFake,
  subLink,
  large = false,
}) {
  const escapedName = escapeName(name);
  const img = require(`images/${escapedName}.png`);
  if (isFake) {
    return (
      <div className={css(styles.link, styles.fake)}>
        <img className={css(styles.image)} src={img} alt={name} />
      </div>
    );
  }
  return (
    <Link
      to={'/' + escapedName + (subLink ? '/' + subLink : '')}
      className={css(styles.link, styles.real, large && styles.largeLink)}
      title={name}
    >
      <img
        className={css(styles.image, large && styles.largeImage)}
        src={img}
        alt={name}
      />
    </Link>
  );
}