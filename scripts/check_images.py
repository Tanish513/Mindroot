import pptx

prs = pptx.Presentation('Mindroot_Project_Presentation_v3.pptx')
diagram_slides = [10, 12, 15, 17, 18, 19, 20, 22, 31, 33, 35, 37]
slides = list(prs.slides)

for s_num in diagram_slides:
    s = slides[s_num - 1]
    pic = None
    for sp in s.shapes:
        if sp.shape_type == pptx.enum.shapes.MSO_SHAPE_TYPE.PICTURE:
            pic = sp
            break
    if pic:
        left = pic.left / 914400
        top = pic.top / 914400
        w = pic.width / 914400
        h = pic.height / 914400
        bottom = top + h
        clearance = 7.0 - bottom
        print(f"Slide {s_num:2d}: left={left:5.2f} in, top={top:5.2f} in, w={w:5.2f} in, h={h:5.2f} in, bottom={bottom:5.2f} in, clearance={clearance:5.2f} in")
    else:
        print(f"Slide {s_num:2d}: NO PICTURE")
