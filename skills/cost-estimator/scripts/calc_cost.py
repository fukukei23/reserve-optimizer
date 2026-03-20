#!/usr/bin/env python3
"""コスト試算スクリプト"""

import sys

def calc_cost(input_tokens: int, output_tokens: int) -> tuple[float, float]:
    """コストを計算する（USD, 円）"""
    input_cost = input_tokens / 1_000_000 * 1.0
    output_cost = output_tokens / 1_000_000 * 3.2
    total_usd = input_cost + output_cost
    total_jpy = total_usd * 160  # 1USD = 160円換算
    return total_usd, total_jpy

def main():
    if len(sys.argv) < 3:
        print("Usage: calc_cost.py <input_tokens> <output_tokens>")
        sys.exit(1)
    
    try:
        input_tokens = int(sys.argv[1])
        output_tokens = int(sys.argv[2])
    except ValueError:
        print("エラー: 整数を入力してください")
        sys.exit(1)
    
    usd, jpy = calc_cost(input_tokens, output_tokens)
    print(f"【コスト試算】")
    print(f"- 入力: ~{input_tokens}トークン")
    print(f"- 出力: ~{output_tokens}トークン")
    print(f"- 概算: ${usd:.4f}（約{jpy:.1f}円）")

if __name__ == "__main__":
    main()
