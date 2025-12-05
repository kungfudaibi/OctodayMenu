#!/usr/bin/env python3
"""
图片token消耗分析工具

用法：
    python analyze_tokens.py <folder_path>

功能：
- 分析文件夹中所有图片的尺寸和预估token消耗
- 比较压缩前后的token差异
- 提供优化建议
"""

import os
import sys
from pathlib import Path
from PIL import Image
import json


def estimate_tokens(width: int, height: int) -> int:
    """估算Vision API的token消耗"""
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


def analyze_image(image_path: str) -> dict:
    """分析单张图片"""
    try:
        with Image.open(image_path) as img:
            width, height = img.size
            file_size = os.path.getsize(image_path)
            
            # 原始token消耗
            original_tokens = estimate_tokens(width, height)
            
            # 不同压缩设置下的token消耗
            compressed_scenarios = []
            for max_size in [512, 768, 1024, 1280]:
                if max(width, height) > max_size:
                    if width > height:
                        new_width = max_size
                        new_height = int(height * max_size / width)
                    else:
                        new_height = max_size
                        new_width = int(width * max_size / height)
                else:
                    new_width, new_height = width, height
                
                compressed_tokens = estimate_tokens(new_width, new_height)
                compression_ratio = compressed_tokens / original_tokens if original_tokens > 0 else 1
                
                compressed_scenarios.append({
                    "max_size": max_size,
                    "new_dimensions": f"{new_width}x{new_height}",
                    "tokens": compressed_tokens,
                    "compression_ratio": compression_ratio,
                    "token_savings": original_tokens - compressed_tokens
                })
            
            return {
                "path": image_path,
                "original_dimensions": f"{width}x{height}",
                "file_size_kb": file_size / 1024,
                "original_tokens": original_tokens,
                "compressed_scenarios": compressed_scenarios,
                "success": True
            }
    except Exception as e:
        return {
            "path": image_path,
            "error": str(e),
            "success": False
        }


def main():
    if len(sys.argv) < 2:
        print("用法: python analyze_tokens.py <folder_path>")
        sys.exit(1)
    
    folder_path = sys.argv[1]
    
    if not os.path.isdir(folder_path):
        print(f"❌ 文件夹不存在: {folder_path}")
        sys.exit(1)
    
    # 查找图片文件
    image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'}
    image_files = []
    
    for file_path in Path(folder_path).iterdir():
        if file_path.is_file() and file_path.suffix.lower() in image_extensions:
            image_files.append(str(file_path))
    
    if not image_files:
        print(f"❌ 在 {folder_path} 中未找到图片文件")
        sys.exit(1)
    
    print(f"🔍 分析 {len(image_files)} 张图片的token消耗...")
    print("=" * 80)
    
    results = []
    total_original_tokens = 0
    
    for image_path in image_files:
        result = analyze_image(image_path)
        results.append(result)
        
        if result['success']:
            filename = os.path.basename(image_path)
            tokens = result['original_tokens']
            dimensions = result['original_dimensions']
            file_size = result['file_size_kb']
            
            print(f"📷 {filename}")
            print(f"   尺寸: {dimensions} | 大小: {file_size:.1f}KB | Token: {tokens}")
            
            total_original_tokens += tokens
            
            # 显示最佳压缩选项
            best_scenario = min(result['compressed_scenarios'], 
                              key=lambda x: x['tokens'])
            if best_scenario['token_savings'] > 0:
                savings_percent = (best_scenario['token_savings'] / tokens) * 100
                print(f"   💡 推荐压缩到 {best_scenario['max_size']}px: "
                      f"{best_scenario['tokens']} tokens (-{savings_percent:.1f}%)")
            else:
                print(f"   ✅ 当前尺寸已最优")
            print()
    
    # 总结统计
    successful_results = [r for r in results if r['success']]
    print("=" * 80)
    print("📊 统计摘要:")
    print(f"   处理成功: {len(successful_results)}/{len(results)} 张图片")
    print(f"   原始总token消耗: {total_original_tokens:,}")
    
    if successful_results:
        # 计算不同压缩设置的总节省
        for max_size in [512, 768, 1024, 1280]:
            total_compressed = sum(
                min(scenario['tokens'] for scenario in r['compressed_scenarios'] 
                    if scenario['max_size'] == max_size)
                for r in successful_results
            )
            savings = total_original_tokens - total_compressed
            savings_percent = (savings / total_original_tokens) * 100 if total_original_tokens > 0 else 0
            
            print(f"   压缩到 {max_size}px: {total_compressed:,} tokens "
                  f"(节省 {savings:,} tokens, {savings_percent:.1f}%)")
    
    # 生成建议
    print("\n💡 优化建议:")
    large_images = [r for r in successful_results if r['original_tokens'] > 1000]
    if large_images:
        print(f"   • 有 {len(large_images)} 张高token消耗图片 (>1000 tokens)")
        print("   • 建议使用 --compress --max-size 1024 来减少token消耗")
    else:
        print("   • 所有图片的token消耗都比较合理")
    
    print(f"   • 预估批量处理成本: ~{total_original_tokens * 0.00001:.4f} USD (假设$0.01/1K tokens)")
    
    # 保存详细分析结果
    output_file = "token_analysis.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n📁 详细分析结果已保存到: {output_file}")


if __name__ == "__main__":
    main()