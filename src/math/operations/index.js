// @flow strict
import _ from 'lodash';
import { truncate, rectify } from './truncate';
import { cumulate } from './cumulate';
import { expand, snub, dual } from './expand';
import { contract } from './contract';
import { elongate, gyroelongate } from './elongate';
import { shorten } from './shorten';
import { augment } from './augment';
import { diminish } from './diminish';
import { gyrate } from './gyrate';
import { normalizeOperation } from './operationUtils';

const rawOps = {
    dual,
    truncate,
    rectify,
    cumulate,
    expand,
    snub,
    contract,
    augment,
    elongate,
    gyroelongate,
    diminish,
    shorten,
    gyrate,
};

export const operations = _.mapValues(rawOps, normalizeOperation);

export type { OpName, OperationResult } from './operationTypes';
