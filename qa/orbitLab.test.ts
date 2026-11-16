import { describe, expect, it, beforeEach } from 'vitest'
import { LAB_ELEMENTS, LAB_RECIPES, LAB_TARGETS } from '@/data/orbitLabData'
import { allReachable, combine, getLabProgress, labTarget, nextStep, pathTo, resetOrbitLab, takeHint, todaysElements, tryCombine, BASE_IDS } from '@/services/orbitLabService'

describe('Orbit Lab', () => {
  beforeEach(() => resetOrbitLab())

  it('every element and target is reachable and recipes are consistent', () => {
    expect(allReachable()).toBe(true)
    const ids = new Set(LAB_ELEMENTS.map((e) => e.id))
    const pairs = new Map<string, string>()
    for (const r of LAB_RECIPES) {
      expect(ids.has(r.a) && ids.has(r.b) && ids.has(r.out)).toBe(true)
      const k = [r.a, r.b].sort().join('+')
      if (pairs.has(k)) expect(pairs.get(k)).toBe(r.out)
      pairs.set(k, r.out)
    }
    for (const t of LAB_TARGETS) expect(pathTo(t).length).toBeGreaterThan(1)
    expect(combine('water', 'fire')).toBe('steam')
    expect(combine('fire', 'water')).toBe('steam')
  })

  it('hints alone solve every target', () => {
    for (const t of LAB_TARGETS) {
      const have = new Set(BASE_IDS)
      let n = 0
      while (!have.has(t) && n++ < 60) {
        const s = nextStep(have, t)
        expect(s).not.toBeNull()
        have.add(s!.out)
      }
      expect(have.has(t)).toBe(true)
    }
  })

  it('plays a day: combine, solve, hints, streak', () => {
    const day = 4
    const target = labTarget(day)
    let p = getLabProgress('a1', day)
    expect(p.today.target).toBe(target)
    expect(tryCombine('a1', day, 'water', 'earth').out?.id).toBe('mud')
    expect(tryCombine('a1', day, 'light', 'light').out).toBeNull()
    expect(takeHint('a1', day).recipe).not.toBeNull()
    for (const step of pathTo(target)) tryCombine('a1', day, step.a, step.b)
    p = getLabProgress('a1', day)
    expect(p.today.solved).toBe(true)
    expect(p.streak).toBe(1)
    expect(todaysElements(p.today)).toContain(target)
    // next day starts fresh
    expect(getLabProgress('a1', day + 1).today.found).toEqual([])
    expect(getLabProgress('a1', day + 1).streak).toBe(1)
  })
})
