import { createContext } from 'react'

// Direction of travel for every <Roll> below: 1 = forward (new text comes in from the right), -1 = back.
export const RollDir = createContext<1 | -1>(1)
