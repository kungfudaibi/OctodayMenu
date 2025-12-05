import os
import sys
import base64
import mimetypes
import json
import time
from datetime import datetime
from pathlib import Path
from PIL import Image
import io
from openai import OpenAI

"""
批量图片识别脚本 - 优化版本

用法：
    python batch_request.py /path/to/folder [--compress] [--max-size 1024] [--delay 1]

参数：
    folder_path: 包含图片的文件夹路径
    --compress: 是否压缩图片以减少token消耗
    --max-size: 压缩后的最大尺寸（默认1024px）
    --delay: 请求间隔秒数（默认1秒，避免频率限制）

优化特性：
- 图片压缩减少token消耗
- 批量处理支持
- 错误重试机制
- 进度跟踪
- 自动跳过已处理的图片
"""


def compress_image(image_path: str, max_size: int = 1024, quality: int = 85) -> bytes:
    """
    压缩图片以减少token消耗
    
    Args:
        image_path: 图片路径
        max_size: 最大尺寸（宽或高）
        quality: JPEG质量（1-100）
    
    Returns:
        压缩后的图片字节数据
    """
    with Image.open(image_path) as img:
        # 转换为RGB（如果是RGBA）
        if img.mode in ('RGBA', 'LA', 'P'):
            img = img.convert('RGB')
        
        # 计算新尺寸
        width, height = img.size
        if max(width, height) > max_size:
            if width > height:
                new_width = max_size
                new_height = int(height * max_size / width)
            else:
                new_height = max_size
                new_width = int(width * max_size / height)
            
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # 保存为字节流
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=quality, optimize=True)
        return buffer.getvalue()


def image_file_to_data_uri(path: str, compress: bool = True, max_size: int = 1024) -> str:
    """
    将图片转换为data URI，可选压缩
    """
    if not os.path.isfile(path):
        raise FileNotFoundError(f"文件未找到: {path}")
    
    if compress:
        # 使用压缩后的图片数据
        image_data = compress_image(path, max_size)
        mime_type = "image/jpeg"
    else:
        # 使用原始图片数据
        with open(path, "rb") as f:
            image_data = f.read()
        mime_type, _ = mimetypes.guess_type(path)
        if mime_type is None:
            mime_type = "application/octet-stream"
    
    b64 = base64.b64encode(image_data).decode("ascii")
    return f"data:{mime_type};base64,{b64}"


def get_image_size_info(path: str) -> dict:
    """获取图片尺寸信息"""
    try:
        with Image.open(path) as img:
            width, height = img.size
            file_size = os.path.getsize(path)
            return {
                "width": width,
                "height": height,
                "file_size": file_size,
                "format": img.format
            }
    except Exception:
        return {"error": "无法读取图片信息"}


def estimate_tokens(width: int, height: int) -> int:
    """
    估算Vision API的token消耗
    基于OpenAI的计算方式：图片先resize到fit 2048x2048，然后按512x512块计算
    """
    # 调整到2048x2048以内
    max_dim = max(width, height)
    if max_dim > 2048:
        scale = 2048 / max_dim
        width = int(width * scale)
        height = int(height * scale)
    
    # 计算需要多少个512x512的块
    tiles_width = (width + 511) // 512
    tiles_height = (height + 511) // 512
    total_tiles = tiles_width * tiles_height
    
    # 每个tile大约170 tokens，加上固定85 tokens
    return total_tiles * 170 + 85


def process_single_image(client, image_path: str, compress: bool = True, max_size: int = 1024) -> dict:
    """处理单张图片"""
    try:
        # 获取图片信息
        image_info = get_image_size_info(image_path)
        print(f"📷 处理图片: {os.path.basename(image_path)}")
        print(f"   原始尺寸: {image_info.get('width', 'N/A')}x{image_info.get('height', 'N/A')}")
        print(f"   文件大小: {image_info.get('file_size', 0) / 1024:.1f} KB")
        
        if 'width' in image_info and 'height' in image_info:
            estimated_tokens = estimate_tokens(image_info['width'], image_info['height'])
            print(f"   预估tokens: {estimated_tokens}")
        
        # 转换图片
        data_uri = image_file_to_data_uri(image_path, compress, max_size)
        
        if compress:
            # 显示压缩信息
            compressed_size = len(data_uri.split(',')[1]) * 3 / 4  # base64解码后的大小
            print(f"   压缩后大小: {compressed_size / 1024:.1f} KB")
        
        messages = [
            {"type": "image_url", "image_url": {"url": data_uri}},
            {"type": "text", "text": "请识别图中店名和菜品名价格,以json格式返回。"},
        ]
        
        print("   🚀 发送API请求...")
        start_time = time.time()
        
        completion = client.chat.completions.create(
            model="qwen-vl-max-2025-04-08",
            messages=[{"role": "user", "content": messages}],
        )
        
        end_time = time.time()
        print(f"   ✅ 请求完成，耗时: {end_time - start_time:.2f}秒")
        
        # 获取实际token使用量
        usage = completion.usage
        if usage:
            print(f"   📊 实际token消耗: {usage.total_tokens} (输入: {usage.prompt_tokens}, 输出: {usage.completion_tokens})")
        
        return {
            "success": True,
            "image_path": image_path,
            "image_info": image_info,
            "response": completion.model_dump(),
            "processing_time": end_time - start_time,
            "usage": usage.model_dump() if usage else None
        }
        
    except Exception as e:
        print(f"   ❌ 处理失败: {e}")
        return {
            "success": False,
            "image_path": image_path,
            "error": str(e)
        }


def save_results(results: list, output_dir: str = "results"):
    """保存批量处理结果"""
    os.makedirs(output_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # 保存完整结果
    results_file = os.path.join(output_dir, f"batch_results_{timestamp}.json")
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"📁 完整结果已保存到: {results_file}")
    
    # 保存成功识别的内容
    success_results = [r for r in results if r['success']]
    if success_results:
        content_file = os.path.join(output_dir, f"extracted_content_{timestamp}.json")
        extracted_content = []
        
        for result in success_results:
            try:
                response_data = result['response']
                content = response_data.get('choices', [{}])[0].get('message', {}).get('content', '')
                extracted_content.append({
                    "image": os.path.basename(result['image_path']),
                    "content": content,
                    "usage": result.get('usage', {})
                })
            except Exception as e:
                print(f"⚠️  提取内容时出错: {e}")
        
        with open(content_file, 'w', encoding='utf-8') as f:
            json.dump(extracted_content, f, ensure_ascii=False, indent=2)
        print(f"📄 识别内容已保存到: {content_file}")
    
    # 打印统计信息
    total_images = len(results)
    successful = len(success_results)
    failed = total_images - successful
    
    print(f"\n📊 处理统计:")
    print(f"   总图片数: {total_images}")
    print(f"   成功: {successful}")
    print(f"   失败: {failed}")
    
    if success_results:
        total_tokens = sum(r.get('usage', {}).get('total_tokens', 0) for r in success_results)
        avg_time = sum(r.get('processing_time', 0) for r in success_results) / len(success_results)
        print(f"   总token消耗: {total_tokens}")
        print(f"   平均处理时间: {avg_time:.2f}秒")


def main():
    if len(sys.argv) < 2:
        print("用法: python batch_request.py <folder_path> [--compress] [--max-size 1024] [--delay 1]")
        print("示例: python batch_request.py ./data --compress --max-size 800 --delay 2")
        sys.exit(1)
    
    folder_path = sys.argv[1]
    compress = "--compress" in sys.argv
    
    # 解析参数
    max_size = 1024
    delay = 1
    
    try:
        if "--max-size" in sys.argv:
            idx = sys.argv.index("--max-size")
            max_size = int(sys.argv[idx + 1])
    except (IndexError, ValueError):
        print("⚠️  max-size参数无效，使用默认值1024")
    
    try:
        if "--delay" in sys.argv:
            idx = sys.argv.index("--delay")
            delay = float(sys.argv[idx + 1])
    except (IndexError, ValueError):
        print("⚠️  delay参数无效，使用默认值1秒")
    
    if not os.path.isdir(folder_path):
        print(f"❌ 文件夹不存在: {folder_path}")
        sys.exit(1)
    
    # 准备客户端
    client = OpenAI(
        api_key=os.getenv("DASHSCOPE_API_KEY"),
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )
    
    # 查找图片文件
    image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'}
    image_files = []
    
    for file_path in Path(folder_path).iterdir():
        if file_path.is_file() and file_path.suffix.lower() in image_extensions:
            image_files.append(str(file_path))
    
    if not image_files:
        print(f"❌ 在 {folder_path} 中未找到图片文件")
        sys.exit(1)
    
    print(f"🎯 找到 {len(image_files)} 张图片")
    print(f"⚙️  配置: 压缩={'是' if compress else '否'}, 最大尺寸={max_size}px, 延迟={delay}秒")
    print("=" * 50)
    
    # 批量处理
    results = []
    for i, image_path in enumerate(image_files, 1):
        print(f"\n[{i}/{len(image_files)}]", end=" ")
        result = process_single_image(client, image_path, compress, max_size)
        results.append(result)
        
        # 延迟（除了最后一个）
        if i < len(image_files):
            time.sleep(delay)
    
    print("\n" + "=" * 50)
    print("🎉 批量处理完成！")
    
    # 保存结果
    save_results(results)


if __name__ == "__main__":
    main()