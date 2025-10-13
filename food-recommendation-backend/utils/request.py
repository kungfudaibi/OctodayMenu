import os
import sys
import base64
import mimetypes
import json
from datetime import datetime
from openai import OpenAI

"""
用法：
    python request.py /path/to/image.jpg

脚本功能：
- 将本地图片文件编码为 base64 data URI
- 调用 OpenAI 兼容的 client（已在顶部的 client 示例中使用）发送一个包含图片和问题的 multimodal 请求

注意：
- 请通过环境变量 DASHSCOPE_API_KEY 配置 API Key，或者在代码中直接填写 api_key。
- 该脚本不会对 API 返回做复杂解析，仅打印结果。
"""


def image_file_to_data_uri(path: str) -> str:
    """把本地图片读为 base64 data URI，返回字符串，例如：
    data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/...
    """
    if not os.path.isfile(path):
        raise FileNotFoundError(f"文件未找到: {path}")
    mime_type, _ = mimetypes.guess_type(path)
    if mime_type is None:
        mime_type = "application/octet-stream"
    with open(path, "rb") as f:
        b = f.read()
    b64 = base64.b64encode(b).decode("ascii")
    return f"data:{mime_type};base64,{b64}"


def main():
    if len(sys.argv) < 2:
        print("请传入图片路径，例如: python request.py ./1.png")
        sys.exit(1)

    image_path = sys.argv[1]

    # 将相对路径转换为绝对路径（相对于项目根目录）
    if not os.path.isabs(image_path):
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        image_path = os.path.join(project_root, image_path)

    print(f"Debug: image_path = {repr(image_path)}", file=sys.stderr)
    print(f"Debug: cwd = {os.getcwd()}", file=sys.stderr)
    print(f"Debug: exists = {os.path.exists(image_path)}", file=sys.stderr)
    print(f"Debug: isfile = {os.path.isfile(image_path)}", file=sys.stderr)

    # 准备客户端（从环境变量读取 API Key）
    client = OpenAI(
        api_key=os.getenv("DASHSCOPE_API_KEY"),
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )

    data_uri = image_file_to_data_uri(image_path)

    messages = [
        {"type": "image_url", "image_url": {"url": data_uri}},
        {"type": "text", "text": "请识别图中店名和菜品名价格,以json。"},
    ]

    print("已准备好请求，正在发送...")
    try:
        completion = client.chat.completions.create(
            model="qwen-vl-max-2025-04-08",
            messages=[{"role": "user", "content": messages}],
        )
        
        # 获取返回的JSON数据
        response_json = completion.model_dump_json()
        print("API返回结果:")
        print(response_json)
        
        # 保存JSON到文件
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        image_name = os.path.splitext(os.path.basename(image_path))[0]
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        data_dir = os.path.join(project_root, "results")
        output_filename = f"result_{image_name}_{timestamp}.json"
        output_path = os.path.join(data_dir, output_filename)
        
        # 确保data目录存在
        os.makedirs(data_dir, exist_ok=True)
        
        # 保存原始响应
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(json.loads(response_json), f, ensure_ascii=False, indent=2)
        
        print(f"✅ JSON结果已保存到: {output_path}")
        
        # 尝试提取并保存识别的内容
        try:
            response_data = json.loads(response_json)
            content = response_data.get('choices', [{}])[0].get('message', {}).get('content', '')
            if content:
                # 保存识别的内容到单独文件
                content_filename = f"content_{image_name}_{timestamp}.txt"
                content_path = os.path.join(data_dir, content_filename)
                with open(content_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"✅ 识别内容已保存到: {content_path}")
                
                # 如果内容是JSON格式，也保存为JSON文件
                try:
                    # 处理markdown代码块中的JSON
                    content_to_parse = content.strip()
                    
                    # 检查是否是markdown代码块
                    if content_to_parse.startswith('```json') and content_to_parse.endswith('```'):
                        # 提取代码块中的内容
                        content_to_parse = content_to_parse[7:-3].strip()  # 移除```json和```
                    elif content_to_parse.startswith('```') and content_to_parse.endswith('```'):
                        # 处理不带语言标识符的代码块
                        content_to_parse = content_to_parse[3:-3].strip()
                    
                    # 现在检查是否是有效的JSON
                    if content_to_parse.startswith('{') or content_to_parse.startswith('['):
                        parsed_content = json.loads(content_to_parse)
                        parsed_filename = f"parsed_{image_name}_{timestamp}.json"
                        parsed_path = os.path.join(data_dir, parsed_filename)
                        with open(parsed_path, 'w', encoding='utf-8') as f:
                            json.dump(parsed_content, f, ensure_ascii=False, indent=2)
                        print(f"✅ 解析后的JSON已保存到: {parsed_path}")
                except json.JSONDecodeError as json_error:
                    print(f"⚠️  JSON解析失败: {json_error}")
                    pass  # 内容不是有效的JSON，跳过
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            print(f"⚠️  提取内容时出错: {e}")
        
    except Exception as e:
        print("请求时出错:", e)


if __name__ == "__main__":
    main()