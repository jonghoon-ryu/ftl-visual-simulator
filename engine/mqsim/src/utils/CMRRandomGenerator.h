#ifndef CMR_RANDOM_GENERATOR_H
#define CMR_RANDOM_GENERATOR_H

#include <cstdint>

namespace Utils
{
	class CMRRandomGenerator
	{
		public:
			CMRRandomGenerator(int64_t n, int e);
			void Advance(int64_t n, int e);
			double NextDouble();
		private:
			double s[2][3];
			static double norm, m1, m2, a12, a13, a21, a23;
			static double a[2][3][3];
			static double m[2];
			static double init_s[2][3];


			static double mod(double x, double m)
			{
				int64_t k = (int64_t)(x / m);
				x -= (double)k * m;
				if (x < 0.0) {
					x += m;
				}
				return x;
			}

			/*
			*   Advance CMRG one step and return next number
			*/
			static int64_t ftoi(double x, double m)
			{
				if (x >= 0.0) {
					return (int64_t)(x);
				}
				else {
					return (int64_t)((double)x + (double)m);
				}
			}

			static double itof(int64_t i, int64_t m)
			{
				return (double)i;
			}

			static void v_ftoi(double* u, int64_t* v, double m)
			{
				for (int i = 0; i <= 2; i++) {
					v[i] = ftoi(u[i], m);
				}
			}

			static void v_itof(int64_t* u, double* v, int64_t m)
			{
				for (int i = 0; i <= 2; i++) {
					v[i] = itof((int64_t)u[i], m);
				}
			}

			static void v_copy(int64_t* u, int64_t* v)
			{
				for (int i = 0; i <= 2; i++) {
					v[i] = u[i];
				}
			}

			static void m_ftoi(double a[][3], int64_t b[][3], double m)
			{
				for (int i = 0; i <= 2; i++) {
					for (int j = 0; j <= 2; j++) {
						b[i][j] = ftoi(a[i][j], m);
					}
				}
			}

			static void m_copy(int64_t a[][3], int64_t b[][3])
			{
				for (int i = 0; i <= 2; i++) {
					for (int j = 0; j <= 2; j++) {
						b[i][j] = a[i][j];
					}
				}
			}

			// a[i][j], u[j] and m are all < ~2^32 (MRG32k3a-style moduli), so
			// their product can exceed INT64_MAX and overflow signed int64_t
			// (undefined behavior - was observed to diverge between native
			// and WASM builds because the actual wraparound result of signed
			// overflow is unspecified and compiler/platform-dependent).
			// (m-1)^2 fits safely within uint64_t, so accumulating in
			// unsigned arithmetic gives the mathematically correct,
			// platform-independent result instead.
			static void mv_mul(int64_t a[][3], int64_t* u, int64_t* v, int64_t m)
			{
				int64_t w[3];
				for (int i = 0; i <= 2; i++) {
					uint64_t acc = 0;
					for (int j = 0; j <= 2; j++) {
						acc = (acc + (uint64_t)a[i][j] * (uint64_t)u[j]) % (uint64_t)m;
					}
					w[i] = (int64_t)acc;
				}
				v_copy(w, v);
			}

			static void mm_mul(int64_t a[][3], int64_t b[][3], int64_t c[][3], int64_t m)
			{
				int64_t d [3][3];

				for (int i = 0; i <= 2; i++) {
					for (int j = 0; j <= 2; j++) {
						uint64_t acc = 0;
						for (int k = 0; k <= 2; k++) {
							acc = (acc + (uint64_t)a[i][k] * (uint64_t)b[k][j]) % (uint64_t)m;
						}
						d[i][j] = (int64_t)acc;
					}
				}
				m_copy(d, c);
			}
	};
}

#endif // !CMR_RANDOM_GENERATOR_H
