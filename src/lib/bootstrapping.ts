/**
 * Yield Curve Bootstrapping and Interpolation
 * 
 * This module implements proper financial bootstrapping techniques to estimate
 * missing yield curve points using:
 * 1. Linear Interpolation (for missing points between known values)
 * 2. Cubic Spline Interpolation (for smoother curves)
 * 3. Nelson-Siegel Model (industry-standard parametric model)
 * 
 * References:
 * - Nelson, C.R. and Siegel, A.F. (1987) "Parsimonious Modeling of Yield Curves"
 * - Svensson, L.E.O. (1994) "Estimating and Interpreting Forward Interest Rates"
 */

import { CountryYieldData } from '@/types/yield';

/**
 * Convert maturity string to years (decimal)
 * e.g., "3M" -> 0.25, "1Y" -> 1, "10Y" -> 10
 */
export function maturityToYears(maturity: string): number {
  const normalized = maturity.toUpperCase().trim();
  
  // Handle month format (e.g., "3M", "6M")
  const monthMatch = normalized.match(/^(\d+)M$/);
  if (monthMatch) {
    return parseInt(monthMatch[1], 10) / 12;
  }
  
  // Handle year format (e.g., "1Y", "10Y")
  const yearMatch = normalized.match(/^(\d+)Y$/);
  if (yearMatch) {
    return parseInt(yearMatch[1], 10);
  }
  
  // Handle week format (e.g., "1W")
  const weekMatch = normalized.match(/^(\d+)W$/);
  if (weekMatch) {
    return parseInt(weekMatch[1], 10) / 52;
  }
  
  return NaN;
}

/**
 * Linear interpolation between two points
 * y = y1 + (x - x1) * (y2 - y1) / (x2 - x1)
 */
function linearInterpolate(
  x: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return y1 + ((x - x1) * (y2 - y1)) / (x2 - x1);
}

/**
 * Natural cubic spline interpolation
 * Solves the tridiagonal system for second derivatives
 * then interpolates using cubic polynomials
 */
function cubicSplineInterpolate(
  knownX: number[],
  knownY: number[],
  targetX: number[]
): number[] {
  const n = knownX.length;
  if (n < 2) return targetX.map(() => NaN);
  if (n === 2) {
    // Fall back to linear for only 2 points
    return targetX.map(x => linearInterpolate(x, knownX[0], knownY[0], knownX[1], knownY[1]));
  }

  // Step 1: Compute h[i] = x[i+1] - x[i]
  const h: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(knownX[i + 1] - knownX[i]);
  }

  // Step 2: Set up tridiagonal system for second derivatives (M)
  // Natural spline: M[0] = M[n-1] = 0
  const alpha: number[] = [0];
  for (let i = 1; i < n - 1; i++) {
    alpha.push(
      (3 / h[i]) * (knownY[i + 1] - knownY[i]) -
      (3 / h[i - 1]) * (knownY[i] - knownY[i - 1])
    );
  }

  // Step 3: Solve tridiagonal system using Thomas algorithm
  const l: number[] = [1];
  const mu: number[] = [0];
  const z: number[] = [0];

  for (let i = 1; i < n - 1; i++) {
    l.push(2 * (knownX[i + 1] - knownX[i - 1]) - h[i - 1] * mu[i - 1]);
    mu.push(h[i] / l[i]);
    z.push((alpha[i] - h[i - 1] * z[i - 1]) / l[i]);
  }

  l.push(1);
  z.push(0);

  // Second derivatives (M values)
  const M: number[] = new Array(n).fill(0);
  for (let j = n - 2; j >= 0; j--) {
    M[j] = z[j] - mu[j] * M[j + 1];
  }

  // Step 4: Interpolate for each target x
  return targetX.map(x => {
    // Find the interval containing x
    let i = 0;
    for (let j = 0; j < n - 1; j++) {
      if (x >= knownX[j] && x <= knownX[j + 1]) {
        i = j;
        break;
      }
      if (x < knownX[0]) {
        i = 0;
        break;
      }
      if (x > knownX[n - 1]) {
        i = n - 2;
        break;
      }
    }

    const hi = h[i];
    const xi = knownX[i];
    const xi1 = knownX[i + 1];
    const yi = knownY[i];
    const yi1 = knownY[i + 1];
    const Mi = M[i];
    const Mi1 = M[i + 1];

    // Cubic spline formula:
    // S(x) = (1/6h)(Mi(xi+1 - x)³ + Mi+1(x - xi)³) + 
    //        (yi/h - hMi/6)(xi+1 - x) + (yi+1/h - hMi+1/6)(x - xi)
    const a = (xi1 - x) / hi;
    const b = (x - xi) / hi;

    return (
      a * yi +
      b * yi1 +
      ((a * a * a - a) * Mi + (b * b * b - b) * Mi1) * (hi * hi) / 6
    );
  });
}

/**
 * Nelson-Siegel Model for yield curve fitting
 * 
 * y(τ) = β₀ + β₁ * ((1 - e^(-τ/λ)) / (τ/λ)) + β₂ * ((1 - e^(-τ/λ)) / (τ/λ) - e^(-τ/λ))
 * 
 * Where:
 * - τ = time to maturity
 * - β₀ = long-term level (asymptotic yield)
 * - β₁ = short-term component (slope)
 * - β₂ = medium-term component (curvature)
 * - λ = decay parameter (typically ~1.5 for government bonds)
 * 
 * This is the standard model used by central banks (Fed, ECB, etc.)
 */
interface NelsonSiegelParams {
  beta0: number;
  beta1: number;
  beta2: number;
  lambda: number;
}

function nelsonSiegelYield(tau: number, params: NelsonSiegelParams): number {
  const { beta0, beta1, beta2, lambda } = params;
  
  if (tau <= 0) return beta0 + beta1;
  
  const tauLambda = tau / lambda;
  const expTerm = Math.exp(-tauLambda);
  const factor1 = (1 - expTerm) / tauLambda;
  const factor2 = factor1 - expTerm;
  
  return beta0 + beta1 * factor1 + beta2 * factor2;
}

/**
 * Fit Nelson-Siegel parameters using least squares optimization
 * Uses gradient descent with reasonable initial guesses
 */
function fitNelsonSiegel(
  maturities: number[],
  yields: number[]
): NelsonSiegelParams {
  const n = maturities.length;
  if (n < 3) {
    // Not enough points, return simple estimates
    const avgYield = yields.reduce((a, b) => a + b, 0) / n;
    return { beta0: avgYield, beta1: 0, beta2: 0, lambda: 1.5 };
  }

  // Initial guesses based on observed data
  const shortYield = yields[0];
  const longYield = yields[n - 1];
  const midIndex = Math.floor(n / 2);
  const midYield = yields[midIndex];
  
  let params: NelsonSiegelParams = {
    beta0: longYield,
    beta1: shortYield - longYield,
    beta2: 2 * midYield - shortYield - longYield,
    lambda: 1.5
  };

  // Simple gradient descent optimization
  const learningRate = 0.01;
  const iterations = 500;
  const epsilon = 0.0001;

  for (let iter = 0; iter < iterations; iter++) {
    // Compute gradient numerically
    const gradients: NelsonSiegelParams = { beta0: 0, beta1: 0, beta2: 0, lambda: 0 };
    
    let totalError = 0;
    for (let i = 0; i < n; i++) {
      const predicted = nelsonSiegelYield(maturities[i], params);
      const error = predicted - yields[i];
      totalError += error * error;
      
      // Numerical gradient
      for (const key of ['beta0', 'beta1', 'beta2', 'lambda'] as const) {
        const paramPlus = { ...params, [key]: params[key] + epsilon };
        const paramMinus = { ...params, [key]: params[key] - epsilon };
        const gradient = 
          (nelsonSiegelYield(maturities[i], paramPlus) - 
           nelsonSiegelYield(maturities[i], paramMinus)) / (2 * epsilon);
        gradients[key] += 2 * error * gradient;
      }
    }

    // Update parameters
    params = {
      beta0: params.beta0 - learningRate * gradients.beta0 / n,
      beta1: params.beta1 - learningRate * gradients.beta1 / n,
      beta2: params.beta2 - learningRate * gradients.beta2 / n,
      lambda: Math.max(0.1, params.lambda - learningRate * gradients.lambda / n)
    };

    // Early stopping if converged
    if (totalError / n < 0.0001) break;
  }

  return params;
}

export type InterpolationMethod = 'linear' | 'cubic-spline' | 'nelson-siegel';

/**
 * Main bootstrapping function
 * Fills in missing yield values using the specified interpolation method
 */
export function bootstrapYieldCurve(
  countryData: CountryYieldData,
  allMaturities: string[],
  method: InterpolationMethod = 'cubic-spline'
): CountryYieldData {
  // Extract known points
  const knownPoints: { maturity: string; years: number; rate: number }[] = [];
  
  for (const maturity of allMaturities) {
    const rate = countryData.rates[maturity];
    if (rate !== null && rate !== undefined) {
      const years = maturityToYears(maturity);
      if (!isNaN(years)) {
        knownPoints.push({ maturity, years, rate });
      }
    }
  }

  // If we have fewer than 2 points, we can't interpolate
  if (knownPoints.length < 2) {
    return countryData;
  }

  // Sort by maturity
  knownPoints.sort((a, b) => a.years - b.years);

  const knownX = knownPoints.map(p => p.years);
  const knownY = knownPoints.map(p => p.rate);

  // Find missing maturities within the range of known data
  const missingMaturities: { maturity: string; years: number }[] = [];
  const minYears = knownX[0];
  const maxYears = knownX[knownX.length - 1];

  for (const maturity of allMaturities) {
    const rate = countryData.rates[maturity];
    if (rate === null || rate === undefined) {
      const years = maturityToYears(maturity);
      // Only interpolate within the range (no extrapolation)
      if (!isNaN(years) && years >= minYears && years <= maxYears) {
        missingMaturities.push({ maturity, years });
      }
    }
  }

  if (missingMaturities.length === 0) {
    return countryData;
  }

  // Interpolate based on method
  const targetX = missingMaturities.map(m => m.years);
  let interpolatedRates: number[];

  switch (method) {
    case 'linear': {
      interpolatedRates = targetX.map(x => {
        // Find surrounding points
        let lowerIdx = 0;
        for (let i = 0; i < knownX.length - 1; i++) {
          if (knownX[i] <= x && knownX[i + 1] >= x) {
            lowerIdx = i;
            break;
          }
        }
        return linearInterpolate(
          x,
          knownX[lowerIdx],
          knownY[lowerIdx],
          knownX[lowerIdx + 1],
          knownY[lowerIdx + 1]
        );
      });
      break;
    }
    
    case 'cubic-spline': {
      interpolatedRates = cubicSplineInterpolate(knownX, knownY, targetX);
      break;
    }
    
    case 'nelson-siegel': {
      const params = fitNelsonSiegel(knownX, knownY);
      interpolatedRates = targetX.map(x => nelsonSiegelYield(x, params));
      break;
    }
    
    default:
      interpolatedRates = targetX.map(() => NaN);
  }

  // Create new rates object with interpolated values
  const newRates = { ...countryData.rates };
  for (let i = 0; i < missingMaturities.length; i++) {
    const rate = interpolatedRates[i];
    if (!isNaN(rate) && isFinite(rate)) {
      newRates[missingMaturities[i].maturity] = Math.round(rate * 100) / 100;
    }
  }

  return {
    ...countryData,
    rates: newRates
  };
}

/**
 * Apply bootstrapping to all countries
 */
export function bootstrapAllYieldCurves(
  data: CountryYieldData[],
  maturities: string[],
  method: InterpolationMethod = 'cubic-spline'
): CountryYieldData[] {
  return data.map(country => bootstrapYieldCurve(country, maturities, method));
}
