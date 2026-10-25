import os
import win32com.client
from pptx import Presentation

# Test opening Mindroot_Project_Presentation_v3.pptx with full error traceback
ppt = win32com.client.Dispatch('PowerPoint.Application')
p_path = os.path.abspath('Mindroot_Project_Presentation_v3.pptx')
try:
    pres = ppt.Presentations.Open(p_path)
    print("Opened v3 successfully! Slides:", pres.Slides.Count)
    pres.Close()
except Exception as e:
    print("Failed to open v3:", e)
finally:
    ppt.Quit()
