# 5. 其他框架

LLM 之外最活跃的方向是**图像生成**——Stable Diffusion、FLUX 等等。这块有两个主导工具：ComfyUI（图形界面）和 Diffusers（代码库）。

## ComfyUI——可视化 AI 画图工作台

提供一个类似 Blender 节点编辑器的界面，可以通过拖拽和连线来搭建图像生成流程，而不是写代码。

类比：如果 Stable Diffusion 是一台相机，ComfyUI 就是一个可视化的暗房——你可以任意组合"加载模型 -> 写提示词 -> 采样 -> 放大 -> 输出"等步骤。

**技术特点**：
- 基于节点的工作流设计，每个操作是一个"节点"
- 支持 Stable Diffusion 1.5/XL/3、FLUX、ControlNet 等几乎所有主流图像生成模型
- 可以保存和分享工作流（JSON 格式）
- 比 WebUI（另一个常见的 SD 界面）更灵活、更适合复杂流程

## Diffusers——扩散模型的统一工具箱

Hugging Face 出品的扩散模型库，提供一行代码就能调用各种图像/音频生成模型的简洁接口。

类比：如果各种图像生成模型（Stable Diffusion、SDXL、FLUX）是不同品牌的相机，Diffusers 就是一个万能遥控器——统一的操作方式控制所有相机。

**与 ComfyUI 的区别**：
- Diffusers 是**代码库**（写 Python 调用）
- ComfyUI 是**图形界面**（拖拽节点操作）
- ComfyUI 底层可以用 Diffusers

到这里芯片到框架的整条栈我们都过了一遍。最后还差一块拼图：这一切要怎么打包送上服务器？在 AI 工程里，答案几乎永远是容器镜像。

下一节：[容器镜像与部署 →](./container-images)
