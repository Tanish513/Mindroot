import os
import sys
import win32com.client

def export_slides():
    pptx_path = os.path.abspath("Mindroot_Project_Presentation_v3.pptx")
    out_dir = os.path.abspath("slide_renders_v3")
    os.makedirs(out_dir, exist_ok=True)

    print(f"Opening PowerPoint to export slides from: {pptx_path}")
    powerpoint = win32com.client.Dispatch("PowerPoint.Application")
    # Open presentation in read-only mode, without visible window
    presentation = powerpoint.Presentations.Open(pptx_path, WithWindow=False)

    print(f"Total slides found in PowerPoint: {presentation.Slides.Count}")
    
    for i in range(1, presentation.Slides.Count + 1):
        slide = presentation.Slides(i)
        img_name = f"slide_{i:02d}.png"
        img_path = os.path.join(out_dir, img_name)
        slide.Export(img_path, "PNG", 1920, 1080)
        if i % 10 == 0 or i == presentation.Slides.Count:
            print(f"Exported up to slide {i} of {presentation.Slides.Count}...")

    presentation.Close()
    powerpoint.Quit()
    print(f"All slides exported successfully to {out_dir}")

if __name__ == "__main__":
    export_slides()
