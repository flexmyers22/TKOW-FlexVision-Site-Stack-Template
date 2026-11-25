// joint_error.cu
#include <cuda_runtime.h>
#include <cmath>
#include <iostream>

__global__ void calculateJointError(
    const float* target,
    const float* actual,
    float* error,
    int jointCount)
{
    int i = blockIdx.x * blockDim.x + threadIdx.x;

    if (i < jointCount) {
        error[i] = fabsf(target[i] - actual[i]);
    }
}

int main()
{
    constexpr int N = 6;

    float target[N] = {30, 45, 60, 15, 90, 10};
    float actual[N] = {29, 42, 61, 15, 87, 12};
    float error[N]  = {};

    float *d_target, *d_actual, *d_error;

    cudaMalloc(&d_target, N * sizeof(float));
    cudaMalloc(&d_actual, N * sizeof(float));
    cudaMalloc(&d_error,  N * sizeof(float));

    cudaMemcpy(
        d_target, target,
        N * sizeof(float),
        cudaMemcpyHostToDevice);

    cudaMemcpy(
        d_actual, actual,
        N * sizeof(float),
        cudaMemcpyHostToDevice);

    int threadsPerBlock = 4;
    int blocksPerGrid =
        (N + threadsPerBlock - 1) / threadsPerBlock;

    calculateJointError<<<blocksPerGrid, threadsPerBlock>>>(
        d_target, d_actual, d_error, N);

    cudaDeviceSynchronize();

    cudaMemcpy(
        error, d_error,
        N * sizeof(float),
        cudaMemcpyDeviceToHost);

    for (int i = 0; i < N; ++i) {
        std::cout << "Joint " << i
                  << " error: " << error[i]
                  << " degrees\n";
    }

    cudaFree(d_target);
    cudaFree(d_actual);
    cudaFree(d_error);

    return 0;
}