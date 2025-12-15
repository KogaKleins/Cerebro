"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                    🧠 CÉREBRO - Gerador de Ícones PNG                        ║
║                                                                              ║
║  Converte ícones SVG para PNG nos tamanhos necessários para PWA             ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

from pathlib import Path
import base64
from io import BytesIO

def create_png_icons():
    """Cria ícones PNG usando Pillow e cairosvg"""
    try:
        from PIL import Image
        from cairosvg import svg2png
    except ImportError:
        print("❌ Bibliotecas necessárias não encontradas!")
        print("\nInstale com:")
        print("  pip install Pillow cairosvg")
        return
    
    # Caminho dos ícones
    icons_dir = Path(__file__).parent / 'assets' / 'icons'
    svg_file = icons_dir / 'cerebro-icon-512.svg'
    
    if not svg_file.exists():
        print(f"❌ Arquivo SVG não encontrado: {svg_file}")
        return
    
    print("🎨 Gerando ícones PNG...")
    
    # Ler SVG
    with open(svg_file, 'r', encoding='utf-8') as f:
        svg_data = f.read()
    
    # Gerar ícones nos tamanhos necessários
    sizes = [192, 512]
    
    for size in sizes:
        output_file = icons_dir / f'cerebro-icon-{size}.png'
        
        try:
            # Converter SVG para PNG
            png_data = svg2png(
                bytestring=svg_data.encode('utf-8'),
                output_width=size,
                output_height=size
            )
            
            # Salvar arquivo
            with open(output_file, 'wb') as f:
                f.write(png_data)
            
            print(f"✅ Ícone {size}x{size} criado: {output_file.name}")
            
        except Exception as e:
            print(f"❌ Erro ao gerar ícone {size}x{size}: {e}")
    
    print("\n✨ Ícones gerados com sucesso!")
    print("\nOs ícones foram salvos em:")
    print(f"  {icons_dir}")

if __name__ == '__main__':
    create_png_icons()
